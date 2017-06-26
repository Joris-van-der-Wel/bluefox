#!/usr/bin/env bash
set -ex
Xvfb "$DISPLAY" -ac -noreset -screen 0 1024x768x16 &
# Firefox can crash if you do not have a window manager
# (for example when window.open() tries to maximize the new window)
openbox &
