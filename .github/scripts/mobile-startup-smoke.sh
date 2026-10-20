#!/usr/bin/env bash
set -euo pipefail

apk=mobile/android/app/build/outputs/apk/release/app-release.apk
adb install -r "$apk"
adb logcat -c
adb shell am start -n com.dcxa521gi.mycodemobile/.MainActivity
sleep 25
adb logcat -d -b crash > mobile-startup-crash.log
adb logcat -d -v brief > mobile-startup.log
adb shell uiautomator dump /sdcard/mycode-startup.xml
adb shell cat /sdcard/mycode-startup.xml > mobile-startup-ui.xml
adb exec-out screencap -p > mobile-startup.png
test -n "$(adb shell pidof -s com.dcxa521gi.mycodemobile)"
grep -Eq '连接电脑|Connect to desktop|粘贴配对链接|Paste a pairing link' mobile-startup-ui.xml
