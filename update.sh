#!/bin/bash

# Define ANSI escape codes for colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

INSTALL_DIR="/opt/vast-web"
DATA_DIR="/var/lib/vast-web"

USER="vast-web"
GROUP="vast-web"

SERVICE_NAME='vast-web'

if [[ $UID -ne 0 ]]; then
    echo "Installation should be run as root."
    exit
fi

echo "=> Git clone sources to /tmp"
cd /tmp
git clone https://github.com/alkorolyov/vast-web/
cd vast-web/

echo "=> Stop service"
systemctl stop $SERVICE_NAME

echo "=> Copy sources to $INSTALL_DIR"
cp main.py $INSTALL_DIR
cp -r src $INSTALL_DIR
chown -R $USER:$GROUP $INSTALL_DIR
chown -R $USER:$GROUP $DATA_DIR

echo "=> Restart service"
systemctl start $SERVICE_NAME

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
