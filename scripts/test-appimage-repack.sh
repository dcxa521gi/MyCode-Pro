#!/usr/bin/env bash
set -euo pipefail

# Exercise the real repack and validation scripts without downloading tools.
# The fixtures implement only AppImage extraction/packing. Payload rewriting,
# entry point execution and shared-library assertions run unchanged.
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/mycode-appimage-test.XXXXXX")"
case "$work" in "${TMPDIR:-/tmp}"/mycode-appimage-test.*) ;; *) exit 1 ;; esac
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/tools" "$work/cache/monocode-build"
export PATH="$work/tools:$PATH"
export XDG_CACHE_HOME="$work/cache"

# The production download checksum is still enforced; only the fake cached
# appimagetool's verification is stubbed in this isolated test PATH.
printf '#!/bin/sh\nexit 0\n' > "$work/tools/sha256sum"
printf '#!/bin/sh\nprintf "libwebkit2gtk-4.1.so.0 => fixture\\n"\n' > "$work/tools/ldconfig"
cat > "$work/fake-appimage" <<'IMAGE'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  --appimage-offset) echo 65536 ;;
  --appimage-extract) cp -a "$APPIMAGE_TEST_PAYLOAD" "$PWD/squashfs-root" ;;
  *) echo "Unexpected fixture AppImage argument: ${1:-}" >&2; exit 1 ;;
esac
exit 0
IMAGE
# A real runtime offset points into a larger image. Keep extra comment bytes
# beyond it so the fake tool can detect copying too many or too few bytes.
head -c 65636 /dev/zero | tr '\000' '#' >> "$work/fake-appimage"
cat > "$work/cache/monocode-build/appimagetool-1.9.1-x86_64.AppImage" <<'TOOL'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == --appimage-extract-and-run && "$2" == --no-appstream && "$3" == --runtime-file ]]
[[ "$(wc -c < "$4")" -eq 65536 ]]
cmp "$4" <(head -c 65536 "$APPIMAGE_TEST_INPUT")
cp -a "$5" "$APPIMAGE_TEST_OUTPUT"
cp "$APPIMAGE_TEST_TEMPLATE" "$6"
TOOL
chmod +x "$work/tools/"* "$work/fake-appimage" "$work/cache/monocode-build/"*
export APPIMAGE_TEST_TEMPLATE="$work/fake-appimage"

case_index=0
for binary in MyCode mycode monocode; do
  case_index=$((case_index + 1))
  fixture="$work/case-$case_index-$binary fixture"
  mkdir -p "$fixture/payload/usr/bin" "$fixture/payload/usr/lib" "$fixture/payload/apprun-hooks"
  printf 'bundled webkit\n' > "$fixture/payload/usr/lib/libwebkit2gtk-4.1.so.0"
  printf 'GTK hook\n' > "$fixture/payload/apprun-hooks/linuxdeploy-plugin-gtk.sh"
  printf '#!/bin/sh\necho %s\nprintf "%%s\\n" "$@"\n' "$binary" > "$fixture/payload/usr/bin/$binary"
  chmod +x "$fixture/payload/usr/bin/$binary"
  export APPIMAGE_TEST_PAYLOAD="$fixture/payload"
  export APPIMAGE_TEST_OUTPUT="$fixture/repacked"
  export APPIMAGE_TEST_INPUT="$fixture/input.AppImage"
  cp "$work/fake-appimage" "$APPIMAGE_TEST_INPUT"
  bash "$repo_root/scripts/repack-appimage.sh" "$APPIMAGE_TEST_INPUT"
  [[ ! -e "$APPIMAGE_TEST_OUTPUT/usr/lib" && ! -e "$APPIMAGE_TEST_OUTPUT/apprun-hooks" ]]
  actual="$("$APPIMAGE_TEST_OUTPUT/AppRun" 'first argument' '--flag=value')"
  expected="$(printf '%s\nfirst argument\n--flag=value' "$binary")"
  [[ "$actual" == "$expected" ]]
  export APPIMAGE_TEST_PAYLOAD="$APPIMAGE_TEST_OUTPUT"
  bash "$repo_root/scripts/assert-appimage-host-libs.sh" "$APPIMAGE_TEST_INPUT"
  mkdir -p "$APPIMAGE_TEST_OUTPUT/usr/lib"
  printf 'unexpected library\n' > "$APPIMAGE_TEST_OUTPUT/usr/lib/libunexpected.so.1"
  if bash "$repo_root/scripts/assert-appimage-host-libs.sh" "$APPIMAGE_TEST_INPUT" > "$fixture/rejected.log" 2>&1; then
    echo "Host-library validation accepted a bundled shared library" >&2
    exit 1
  fi
  grep -q 'still contains bundled shared libraries' "$fixture/rejected.log"
  rm "$APPIMAGE_TEST_OUTPUT/usr/lib/libunexpected.so.1"
  mkdir -p "$APPIMAGE_TEST_OUTPUT/apprun-hooks"
  printf 'unexpected GTK hook\n' > "$APPIMAGE_TEST_OUTPUT/apprun-hooks/linuxdeploy-plugin-gtk.sh"
  if bash "$repo_root/scripts/assert-appimage-host-libs.sh" "$APPIMAGE_TEST_INPUT" > "$fixture/rejected-hook.log" 2>&1; then
    echo "Host-library validation accepted the GTK hook" >&2
    exit 1
  fi
  grep -q 'still contains the linuxdeploy GTK hook' "$fixture/rejected-hook.log"
done

fixture="$work/unknown fixture"
mkdir -p "$fixture/payload/usr/bin"
printf '#!/bin/sh\nexit 0\n' > "$fixture/payload/AppRun"
chmod +x "$fixture/payload/AppRun"
export APPIMAGE_TEST_PAYLOAD="$fixture/payload"
export APPIMAGE_TEST_INPUT="$fixture/input.AppImage"
cp "$work/fake-appimage" "$APPIMAGE_TEST_INPUT"
if bash "$repo_root/scripts/repack-appimage.sh" "$APPIMAGE_TEST_INPUT" > "$fixture/rejected-layout.log" 2>&1; then
  echo "Repack accepted an AppImage without its application executable" >&2
  exit 1
fi
grep -q 'Unexpected AppImage layout' "$fixture/rejected-layout.log"
if bash "$repo_root/scripts/assert-appimage-host-libs.sh" "$APPIMAGE_TEST_INPUT" > "$fixture/rejected-entry.log" 2>&1; then
  echo "Host-library validation accepted an empty entry point" >&2
  exit 1
fi
grep -q 'missing its executable entry point' "$fixture/rejected-entry.log"
echo 'AppImage repack fixtures passed: MyCode, mycode, monocode; arguments and host-library enforcement'
