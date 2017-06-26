#!/usr/bin/env bash
set -ex
lsb_release -a
sudo add-apt-repository -y ppa:ubuntu-mozilla-security/ppa
sudo apt-get -qq update
sudo apt-get install -y xvfb openbox chromium-browser firefox
"$FIREFOX_BIN" --version
"$CHROME_BIN" --version
