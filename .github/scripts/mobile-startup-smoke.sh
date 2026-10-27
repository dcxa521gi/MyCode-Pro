#!/usr/bin/env bash
set -euo pipefail

apk=mobile/android/app/build/outputs/apk/release/app-release.apk
for attempt in $(seq 1 30); do
  if [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; then
    break
  fi
  sleep 2
done
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
adb install -r "$apk"
adb logcat -c
adb shell am start -n com.dcxa521gi.mycodemobile/.MainActivity
for attempt in $(seq 1 9); do
  sleep 10
  adb shell uiautomator dump /sdcard/mycode-startup.xml >/dev/null
  adb shell cat /sdcard/mycode-startup.xml > mobile-startup-ui.xml
  if grep -Eq '连接电脑|Connect to desktop|粘贴配对链接|Paste a pairing link' mobile-startup-ui.xml &&
    test -n "$(adb shell pidof -s com.dcxa521gi.mycodemobile)"; then
    break
  fi
  if grep -q 'Quickstep isn.t responding' mobile-startup-ui.xml; then
    python3 - <<'PY'
import re
from pathlib import Path

xml = Path('mobile-startup-ui.xml').read_text()
match = re.search(r'text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', xml)
if match:
    x1, y1, x2, y2 = map(int, match.groups())
    Path('mobile-startup-system-dialog-tap.txt').write_text(f'{(x1 + x2) // 2} {(y1 + y2) // 2}')
PY
    if test -s mobile-startup-system-dialog-tap.txt; then
      adb shell input tap $(cat mobile-startup-system-dialog-tap.txt)
    fi
  fi
  adb shell am start -n com.dcxa521gi.mycodemobile/.MainActivity
done
adb logcat -d -b crash > mobile-startup-crash.log
adb logcat -d -v brief > mobile-startup.log
adb exec-out screencap -p > mobile-startup.png
test -n "$(adb shell pidof -s com.dcxa521gi.mycodemobile)"
grep -Eq '连接电脑|Connect to desktop|粘贴配对链接|Paste a pairing link' mobile-startup-ui.xml
