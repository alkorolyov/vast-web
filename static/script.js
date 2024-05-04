const plotForm = document.getElementById("plot-form");
const plotContainer = document.getElementById("plot-container");
const infoContainer = document.getElementById("info-container");
let plots = null;

function singlePlot(timeseries, name, optsShared) {
    let color = Colors.get();
    const opts = {
        ...optsShared,
        series: [
            {},
            {
                label: name,
                stroke: color,
                fill: hexToRGBA(color, 0.1),
                width: 1/window.devicePixelRatio,
            },
        ],
    };
    plots[name] = new uPlot(opts, timeseries, plotContainer);
}

function createPlots(data) {
    const windowWidth = window.innerWidth //* window.devicePixelRatio;
    const windowHeight = window.innerHeight //* window.devicePixelRatio;
    plots = {};

    let muSync = uPlot.sync("moo");
    let timeseries = data.timeseries;

    const cursorOpts = {
        lock: true,
        focus: {
            prox: 16,
        },
        sync: {
            key: muSync.key,
            setSeries: true,
        },
    };

    let optsShared = {
        width: windowWidth * 0.5, // 80% of window width
        height: windowHeight * 0.25, // 60% of window height
        cursor: cursorOpts,
        class: "plot-container",
    };

    for (const key of Object.keys(timeseries)) {
        let plotData = [timeseries[key][0], timeseries[key][1]]
        singlePlot(timeseries[key], key, optsShared);
    }

}

function updatePlots(data) {
    let timeseries = data.timeseries
    console.log('plots', plots);
    console.log('plots keys', Object.keys(plots));
    // update existing plots with new data
    for (const key of Object.keys(plots)) {
        // console.log('key', key);
        plots[key].setData(timeseries[key]);
        // let plotTitle = document.getElementsByClassName("u-title");
        // plotTitle[i].textContent = `machine_id: ${machineId}`;

    }
}

function updateInfo(data) {
    let info = data.info;
    infoContainer.innerHTML = "";
    for (const key of Object.keys(info)) {
        // let span = `<span style="display: inline-block; width: 120px">${key}</span>` + `<span>${info[key]}</span><br>`;
        let html = `<td>${key}</td><td>${info[key]}</td>`
        infoContainer.innerHTML = infoContainer.innerHTML.concat(html);
    }
}

// Function to fetch data and update plot
function handleSubmitForm() {
    // Get form values
    const machineId = document.getElementById("machine-id").value;
    const fromDate = document.getElementById("from-date").value;
    const toDate = document.getElementById("to-date").value;
    console.log(machineId, fromDate, toDate);

    let url = getUrl(machineId, fromDate, toDate);

    // Show loading spinner and disable button
    showLoading();

    // Fetch data from server
    fetch(url)
        .then(response => response.json())
        .then(packed => unpackJSON(packed))
        .then(data => {
            data.timeseries = fillMissingValues(data.timeseries);
            data.timeseries = costPerGPU(data.timeseries);
            return data;
        })
        .then(data => {
            // console.log(data);
            // console.log(data[0]);
            // Hide loading spinner and enable button
            hideLoading();

            updateInfo(data);

            if (plots) {
                updatePlots(data);
            } else {
                createPlots(data);
            }
        })
        .catch(error => {
            // Hide loading spinner and enable button
            hideLoading();
            console.error('Error fetching data:', error);
        });
}

// Event listener to update plot when the form is submitted
plotForm.addEventListener("submit", function(event) {
    event.preventDefault();
    handleSubmitForm();
});


Colors = {};
Colors.names = {
    red: "#ff0000",
    blue: "#0000ff",
    green: "#00ff00",
    // brown: "#a52a2a",
    // darkorange: "#ff8c00",
    // gold: "#ffd700",
    // darkgreen: "#008000",
    // magenta: "#ff00ff",
    // orange: "#ffa500",

    // darkred: "#8b0000",
    // yellow: "#ffff00"
};

Colors.count = 0;

Colors.get = function() {
    let result;
    let count = -1;
    let names_len = Object.keys(this.names).length;
    // console.log('this.count', this.count);
    // console.log('names length', names_len);
    for (let key in this.names)
        if (this.count === ++count)
            result = this.names[key];
    this.count = ++this.count % names_len;
    return result;
};

// Convert hex color to RGBA format
function hexToRGBA(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

function staircaseFill(data) {
    let ts = data[0];
    let vals = data[1];
    let ts_filled = [];
    let vals_filled = [];

    // inserts a point directly preceding a change in status
    for (let i=0; i < ts.length - 1; i++) {
        ts_filled.push(ts[i]);
        ts_filled.push(ts[i + 1] - 1);
        vals_filled.push(vals[i]);
        vals_filled.push(vals[i]);
    }

    // add last elements
    ts_filled.push(ts.at(-1))
    vals_filled.push(vals.at(-1));

    return [ts_filled, vals_filled];
}

function unpackJSON(packed) {

    // console.log('unpackJSON', packed, packed.reliability_ts);
    console.time('unpack json');
    let ts = {};
    let info = {};

    ts['reliability'] = [
        packed.reliability_ts.map(entry => entry.timestamp),
        packed.reliability_ts.map(entry => entry.reliability / 100),
    ]

    ts['rent'] = [
        packed.rent_ts.map(entry => entry.timestamp),
        packed.rent_ts.map(entry => entry.num_gpus_rented),
    ]

    ts['cost'] = [
        packed.cost_ts.map(entry => entry.timestamp),
        packed.cost_ts.map(entry => entry.dph_base / 1000),
    ]

    ts['num_gpus'] = [
        packed.hardware_ts.map(entry => entry.timestamp),
        packed.hardware_ts.map(entry => entry.num_gpus),
    ]

    ts.rent = staircaseFill(ts.rent);
    ts.cost = staircaseFill(ts.cost);
    ts.num_gpus = staircaseFill(ts.num_gpus);

    // console.log('packed_json:   ', packed);

    let hw = packed.hardware_ts.at(-1);
    let avg = packed.avg_ts.at(-1); // can be zero when machine is less than day online
    let eod = packed.eod_snp[0];
    let num_gpus = hw['num_gpus']
    const cpu_ram = packed.cpu_ram_snp[0].cpu_ram;
    const disk_space = packed.disk_snp[0].disk_space;

    info = {
        'gpu': `${num_gpus} x ${hw['gpu_name']}`,
        'pcie': `${hw['pci_gen']}.0 x${hw['gpu_lanes']}\t${avg?.pcie_bw_avg/10 ?? 0 }Gb/s`,
        'cpu': `${Math.round(hw['cpu_cores']/num_gpus)}C\t\t${Math.round(cpu_ram/num_gpus)}GB\t\t\t${hw['cpu_name']}`,
        'disk': `${Math.round(disk_space/num_gpus)}GB\t${avg?.disk_bw_avg ?? 0}MB/s\t\t${hw['disk_name']}`,
        'inet': `${avg?.inet_down_avg ?? 0}\t\t${avg?.inet_up_avg ?? 0} Mbit/s`,
        'mobo_name': hw['mobo_name'],

        // 'cpu_name': hw['cpu_name'],
        // 'cpu_cores': hw['cpu_cores'],
        // 'cpu_ram': cpu_ram,

        // 'disk_bw': avg['disk_bw_avg'],
        // 'disk_space': disk_space,

        // 'inet_up': avg['inet_up_avg'],
        // 'inet_down': avg['inet_down_avg'],
        'country': eod['country'],
        'isp': eod['isp'],


        // 'disk_name': hw['disk_name'],

    };

    // console.log('packed_json:', packed);

    let data = {
        'info': info,
        'timeseries': ts,
    };

    console.timeEnd('unpack json');
    return data
}

function fillMissingValues(timeseries) {
    // Extracting timestamps and values for each timeseries
    console.time('fillna');
    let timestamps = [];
    let values = [];
    let keys = Object.keys(timeseries);

    // Initialize filledValues arrays
    let filledValues = [];
    for (let i = 0; i < keys.length; i++) {
        filledValues.push([]);
    }

    // Extract timestamps and values for each series
    for (let i = 0; i < keys.length; i++) {
        timestamps.push(timeseries[keys[i]][0]);
        values.push(timeseries[keys[i]][1]);
    }

    // Finding unique timestamps from all series
    let allTimestamps = [...new Set(timestamps.flat())].sort();

    // Fill missing values with last existing value
    for (let i = 0; i < allTimestamps.length; i++) {
        // Fill missing values for each series
        for (let j = 0; j < keys.length; j++) {
            let index = timestamps[j].indexOf(allTimestamps[i]);

            if (index !== -1) {
                filledValues[j].push(values[j][index]);
            } else {
                filledValues[j].push(filledValues[j][filledValues[j].length - 1]);
            }
        }
    }

    // Return the filled timeseries as dictionary
    let filledData = {};
    for (let i = 0; i < keys.length; i++) {
        filledData[keys[i]] = [allTimestamps, filledValues[i]];
    }

    console.timeEnd('fillna');
    return filledData;
}

function costPerGPU(timeseries) {
    let cost = timeseries.cost[1];
    let num_gpus = timeseries.num_gpus[1];
    timeseries.cost[1] = cost.map( function(val, i) {return val / num_gpus[i]});
    delete timeseries.num_gpus;
    return timeseries;
}

// Function to show loading spinner and disable button
function showLoading() {
    const plotButton = document.getElementById("plot-button");
    plotButton.disabled = true;
    plotButton.innerHTML =
        "<span class=\"spinner-border spinner-border-sm\" role=\"status\" aria-hidden=\"true\"></span>" +
        "<span class=\"visible\"> Loading...</span>"
}

// Function to hide loading spinner and enable button
function hideLoading() {
    const plotButton = document.getElementById("plot-button");
    plotButton.disabled = false;
    plotButton.innerHTML = "Plot";
}

function getUrl(machineId, fromDate, toDate) {
    // Construct URL
    let url = `/stats`;

    if (machineId) {
        url += `?machine_id=${machineId}`;
    }
    if (fromDate) {
        url += `&from=${fromDate}`;
    }
    if (toDate) {
        url += `&to=${toDate}`;
    }
    return url;
}


