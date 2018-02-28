#!/usr/bin/env bash
set -ex
lsb_release -a
sudo apt-get -qq update
sudo apt-get install -y xvfb openbox chromium-browser firefox
"$FIREFOX_BIN" --version
"$CHROME_BIN" --version
