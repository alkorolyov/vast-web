#!/bin/bash

# Define ANSI escape codes for colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

INSTALL_DIR="/opt/vast-web"
DATA_DIR="/var/lib/vast-web"
DB_PATH="/var/lib/vast-stats/vast.db"

USER="vast-web"
GROUP="vast-web"

echo -e "=> ${GREEN}Start installation of Vast Webserver service${NC}"

if [[ $UID -ne 0 ]]; then
    echo "Installation should be run as root."
    exit
fi

echo "=> Git clone sources to /tmp"
cd /tmp
git clone https://github.com/alkorolyov/vast-web/
cd vast-web/

echo "=> Create project dir: $INSTALL_DIR $DATA_DIR"
mkdir $INSTALL_DIR || rm -rf $INSTALL_DIR
mkdir $DATA_DIR || echo "$DATA_DIR already exists"

echo "=> Create $USER user/group"
useradd -rs /bin/false $USER -d $INSTALL_DIR

echo "=> Copy sources to $INSTALL_DIR"
cp main.py $INSTALL_DIR
cp update.sh $INSTALL_DIR || echo 'no update.sh'
cp -r src $INSTALL_DIR
cp -r static $INSTALL_DIR
chown -R $USER:$GROUP $INSTALL_DIR
chown -R $USER:$GROUP $DATA_DIR

echo "=> Apt update"
apt-get -qq update -y

echo "=> Install python3 and pip"
apt-get -qq install python3 -y
apt-get -qq install python3-pip -y

echo "=> Install pip requirements"
sudo -u $USER python3 -m pip -q install -r requirements.txt

echo "=> Create service"

SERVICE_NAME='vast-web'

SERVICE_CONTENT="
[Unit]
Description=VastAi WebServer
After=network.target

[Service]
Type=simple
User=$USER
Group=$GROUP
WorkingDirectory=$INSTALL_DIR
ExecStart=python3 $INSTALL_DIR/main.py --db_path $DB_PATH --log_path $DATA_DIR/web.log
#Restart=on-failure

[Install]
WantedBy=multi-user.target
"

echo -e "$SERVICE_CONTENT" > /etc/systemd/system/$SERVICE_NAME.service

echo "=> Start service"
systemctl daemon-reload
systemctl restart $SERVICE_NAME
sleep 5

# check service status
status=$(systemctl is-active $SERVICE_NAME)
if [[ "$status" == "active" ]]; then
    status="${GREEN}$status${NC}"
else
    status="${RED}$status${NC}"
fi
echo -e "=> Service status: $status"

echo "=> Remove /tmp files"
rm -rf /tmp/vast-web

echo "=> Install complete"

