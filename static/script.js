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
    for (const key of Object.keys(info)) {
        // let span = `<span style="display: inline-block; width: 120px">${key}</span>` + `<span>${info[key]}</span><br>`;
        let html = document.getElementById(key);
        console.log(key, html);
        if (html === undefined)
            console.log('key not found:', key);
        html.innerHTML = info[key];
        html.setAttribute("tooltip", info[key]);
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

const countryMap = {
    "AF": "Afghanistan",
    "AX": "Åland Islands",
    "AL": "Albania",
    "DZ": "Algeria",
    "AS": "American Samoa",
    "AD": "Andorra",
    "AO": "Angola",
    "AI": "Anguilla",
    "AQ": "Antarctica",
    "AG": "Antigua and Barbuda",
    "AR": "Argentina",
    "AM": "Armenia",
    "AW": "Aruba",
    "AU": "Australia",
    "AT": "Austria",
    "AZ": "Azerbaijan",
    "BS": "Bahamas",
    "BH": "Bahrain",
    "BD": "Bangladesh",
    "BB": "Barbados",
    "BY": "Belarus",
    "BE": "Belgium",
    "BZ": "Belize",
    "BJ": "Benin",
    "BM": "Bermuda",
    "BT": "Bhutan",
    "BO": "Bolivia",
    "BQ": "Bonaire, Sint Eustatius and Saba",
    "BA": "Bosnia and Herzegovina",
    "BW": "Botswana",
    "BV": "Bouvet Island",
    "BR": "Brazil",
    "IO": "British Indian Ocean Territory",
    "BN": "Brunei Darussalam",
    "BG": "Bulgaria",
    "BF": "Burkina Faso",
    "BI": "Burundi",
    "CV": "Cabo Verde",
    "KH": "Cambodia",
    "CM": "Cameroon",
    "CA": "Canada",
    "KY": "Cayman Islands",
    "CF": "Central African Republic",
    "TD": "Chad",
    "CL": "Chile",
    "CN": "China",
    "CX": "Christmas Island",
    "CC": "Cocos (Keeling) Islands",
    "CO": "Colombia",
    "KM": "Comoros",
    "CG": "Congo",
    "CD": "Congo, Democratic Republic of the",
    "CK": "Cook Islands",
    "CR": "Costa Rica",
    "CI": "Côte d'Ivoire",
    "HR": "Croatia",
    "CU": "Cuba",
    "CW": "Curaçao",
    "CY": "Cyprus",
    "CZ": "Czech Republic",
    "DK": "Denmark",
    "DJ": "Djibouti",
    "DM": "Dominica",
    "DO": "Dominican Republic",
    "EC": "Ecuador",
    "EG": "Egypt",
    "SV": "El Salvador",
    "GQ": "Equatorial Guinea",
    "ER": "Eritrea",
    "EE": "Estonia",
    "SZ": "Eswatini",
    "ET": "Ethiopia",
    "FK": "Falkland Islands (Malvinas)",
    "FO": "Faroe Islands",
    "FJ": "Fiji",
    "FI": "Finland",
    "FR": "France",
    "GF": "French Guiana",
    "PF": "French Polynesia",
    "TF": "French Southern Territories",
    "GA": "Gabon",
    "GM": "Gambia",
    "GE": "Georgia",
    "DE": "Germany",
    "GH": "Ghana",
    "GI": "Gibraltar",
    "GR": "Greece",
    "GL": "Greenland",
    "GD": "Grenada",
    "GP": "Guadeloupe",
    "GU": "Guam",
    "GT": "Guatemala",
    "GG": "Guernsey",
    "GN": "Guinea",
    "GW": "Guinea-Bissau",
    "GY": "Guyana",
    "HT": "Haiti",
    "HM": "Heard Island and McDonald Islands",
    "VA": "Holy See",
    "HN": "Honduras",
    "HK": "Hong Kong",
    "HU": "Hungary",
    "IS": "Iceland",
    "IN": "India",
    "ID": "Indonesia",
    "IR": "Iran, Islamic Republic of",
    "IQ": "Iraq",
    "IE": "Ireland",
    "IM": "Isle of Man",
    "IL": "Israel",
    "IT": "Italy",
    "JM": "Jamaica",
    "JP": "Japan",
    "JE": "Jersey",
    "JO": "Jordan",
    "KZ": "Kazakhstan",
    "KE": "Kenya",
    "KI": "Kiribati",
    "KP": "Korea, Democratic People's Republic of",
    "KR": "Korea, Republic of",
    "KW": "Kuwait",
    "KG": "Kyrgyzstan",
    "LA": "Lao People's Democratic Republic",
    "LV": "Latvia",
    "LB": "Lebanon",
    "LS": "Lesotho",
    "LR": "Liberia",
    "LY": "Libya",
    "LI": "Liechtenstein",
    "LT": "Lithuania",
    "LU": "Luxembourg",
    "MO": "Macao",
    "MG": "Madagascar",
    "MW": "Malawi",
    "MY": "Malaysia",
    "MV": "Maldives",
    "ML": "Mali",
    "MT": "Malta",
    "MH": "Marshall Islands",
    "MQ": "Martinique",
    "MR": "Mauritania",
    "MU": "Mauritius",
    "YT": "Mayotte",
    "MX": "Mexico",
    "FM": "Micronesia, Federated States of",
    "MD": "Moldova, Republic of",
    "MC": "Monaco",
    "MN": "Mongolia",
    "ME": "Montenegro",
    "MS": "Montserrat",
    "MA": "Morocco",
    "MZ": "Mozambique",
    "MM": "Myanmar",
    "NA": "Namibia",
    "NR": "Nauru",
    "NP": "Nepal",
    "NL": "Netherlands",
    "NC": "New Caledonia",
    "NZ": "New Zealand",
    "NI": "Nicaragua",
    "NE": "Niger",
    "NG": "Nigeria",
    "NU": "Niue",
    "NF": "Norfolk Island",
    "MK": "North Macedonia",
    "MP": "Northern Mariana Islands",
    "NO": "Norway",
    "OM": "Oman",
    "PK": "Pakistan",
    "PW": "Palau",
    "PS": "Palestine, State of",
    "PA": "Panama",
    "PG": "Papua New Guinea",
    "PY": "Paraguay",
    "PE": "Peru",
    "PH": "Philippines",
    "PN": "Pitcairn",
    "PL": "Poland",
    "PT": "Portugal",
    "PR": "Puerto Rico",
    "QA": "Qatar",
    "RE": "Réunion",
    "RO": "Romania",
    "RU": "Russian Federation",
    "RW": "Rwanda",
    "BL": "Saint Barthélemy",
    "SH": "Saint Helena, Ascension and Tristan da Cunha",
    "KN": "Saint Kitts and Nevis",
    "LC": "Saint Lucia",
    "MF": "Saint Martin (French part)",
    "PM": "Saint Pierre and Miquelon",
    "VC": "Saint Vincent and the Grenadines",
    "WS": "Samoa",
    "SM": "San Marino",
    "ST": "Sao Tome and Principe",
    "SA": "Saudi Arabia",
    "SN": "Senegal",
    "RS": "Serbia",
    "SC": "Seychelles",
    "SL": "Sierra Leone",
    "SG": "Singapore",
    "SX": "Sint Maarten (Dutch part)",
    "SK": "Slovakia",
    "SI": "Slovenia",
    "SB": "Solomon Islands",
    "SO": "Somalia",
    "ZA": "South Africa",
    "GS": "South Georgia and the South Sandwich Islands",
    "SS": "South Sudan",
    "ES": "Spain",
    "LK": "Sri Lanka",
    "SD": "Sudan",
    "SR": "Suriname",
    "SJ": "Svalbard and Jan Mayen",
    "SE": "Sweden",
    "CH": "Switzerland",
    "SY": "Syrian Arab Republic",
    "TW": "Taiwan, Province of China",
    "TJ": "Tajikistan",
    "TZ": "Tanzania, United Republic of",
    "TH": "Thailand",
    "TL": "Timor-Leste",
    "TG": "Togo",
    "TK": "Tokelau",
    "TO": "Tonga",
    "TT": "Trinidad and Tobago",
    "TN": "Tunisia",
    "TR": "Turkey",
    "TM": "Turkmenistan",
    "TC": "Turks and Caicos Islands",
    "TV": "Tuvalu",
    "UG": "Uganda",
    "UA": "Ukraine",
    "AE": "United Arab Emirates",
    "GB": "United Kingdom of Great Britain and Northern Ireland",
    "US": "United States of America",
    "UM": "United States Minor Outlying Islands",
    "UY": "Uruguay",
    "UZ": "Uzbekistan",
    "VU": "Vanuatu",
    "VE": "Venezuela, Bolivarian Republic of",
    "VN": "Viet Nam",
    "VG": "Virgin Islands, British",
    "VI": "Virgin Islands, U.S.",
    "WF": "Wallis and Futuna",
    "EH": "Western Sahara",
    "YE": "Yemen",
    "ZM": "Zambia",
    "ZW": "Zimbabwe"
};

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

    console.log('packed_json:   ', packed);

    let hw = packed.hardware_ts.at(-1);
    let avg = packed.avg_ts.at(-1); // can be zero when machine is less than day online
    let eod = packed.eod_snp[0];
    let num_gpus = hw.num_gpus;
    const cpu_ram = packed.cpu_ram_snp[0].cpu_ram;
    const disk_space = packed.disk_snp[0].disk_space;

    let verified_map = {
        0: 'unverified',
        1: 'verified',
        2: 'deverified',
        3: 'de-verified',
    }
    const arr_up = `<i class="fa fa-arrow-up" aria-hidden="true"></i>`;
    const arr_down = `<i class="fa fa-arrow-down" aria-hidden="true"></i>`;

    info = {
        'public_ipaddr': `${eod.public_ipaddr}`,
        'country': `${countryMap[eod.country]?.toString()}`,
        'isp': `${eod.isp}`,
        'gpu_name_count': `${num_gpus}x ${hw.gpu_name}`,
        'total_flops': `${hw.total_flops} <span class="small-label" style="font-size: 10px;">&nbsp;TFLOPS</span>`,
        'machine_id': `${eod.machine_id}`,
        'verification': `${verified_map[eod.verification]}`,
        'gpu_ram': `${Math.round(hw.gpu_ram / 1000)} GB`,
        'gpu_mem_bw': `${avg?.gpu_mem_bw_avg} GB/s`,
        'mobo_name': `${hw.mobo_name}`,
        'pci_type': `PCIE ${hw.pci_gen}.0 ${hw.gpu_lanes}x`,
        'pci_bw': `${avg?.pcie_bw_avg / 10} GB/s`,
        'cpu_name': `${hw.cpu_name}`,
        'cpu_cores': `${hw.cpu_cores} cpu`,
        'cpu_ram': `${cpu_ram} GB`,
        'disk_name': `${hw.disk_name}`,
        'disk_bw': `${avg?.disk_bw_avg} MB/s`,
        'disk_space': `${disk_space} GB`,
        'inet_up': `${arr_up} ${avg?.inet_up_avg} Mbps`,
        'inet_down': `${arr_down} ${avg?.inet_down_avg} Mbps`,
        'direct_port_count': `${eod.direct_port_count} ports`,
        'reliability': `${ts.reliability[1].at(-1)}%`,
    };

    console.log('info', info);

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


