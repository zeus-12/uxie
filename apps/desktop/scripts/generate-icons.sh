#!/usr/bin/env bash
# Regenerate every raster icon from the two vector sources:
#   apps/desktop/build/icon.svg   -> macOS app icon (mark on a white rounded tile)
#   apps/web/public/logo.svg      -> the bare, theme-adaptive mark
#
# Requires: rsvg-convert (brew install librsvg), iconutil (macOS), python3 + Pillow.
set -euo pipefail

DESKTOP="$(cd "$(dirname "$0")/.." && pwd)"
BUILD="$DESKTOP/build"
PUB="$DESKTOP/../web/public"
ICON="$BUILD/icon.svg"
LOGO="$PUB/logo.svg"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- macOS .icns ---
mkdir -p "$TMP/icon.iconset"
gen() { rsvg-convert -w "$1" -h "$1" "$ICON" -o "$TMP/icon.iconset/$2"; }
gen 16 icon_16x16.png;       gen 32 icon_16x16@2x.png
gen 32 icon_32x32.png;       gen 64 icon_32x32@2x.png
gen 128 icon_128x128.png;    gen 256 icon_128x128@2x.png
gen 256 icon_256x256.png;    gen 512 icon_256x256@2x.png
gen 512 icon_512x512.png;    gen 1024 icon_512x512@2x.png
iconutil -c icns "$TMP/icon.iconset" -o "$BUILD/icon.icns"
rsvg-convert -w 1024 -h 1024 "$ICON" -o "$BUILD/icon.png"

# --- web favicon.ico + apple-touch-icon.png ---
rsvg-convert -w 256 -h 256 "$ICON" -o "$TMP/tile256.png"
rsvg-convert -w 512 "$LOGO" -o "$TMP/mark.png"
python3 - "$TMP" "$PUB" <<'PY'
import sys
from PIL import Image
tmp, pub = sys.argv[1], sys.argv[2]
Image.open(f"{tmp}/tile256.png").convert("RGBA").save(
    f"{pub}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
mark = Image.open(f"{tmp}/mark.png").convert("RGBA")
S, pad = 180, 22
mw = S - 2 * pad
mh = round(mw * mark.height / mark.width)
mark = mark.resize((mw, mh), Image.LANCZOS)
at = Image.new("RGBA", (S, S), (255, 255, 255, 255))
at.alpha_composite(mark, ((S - mw) // 2, (S - mh) // 2))
at.convert("RGB").save(f"{pub}/apple-touch-icon.png")
PY

echo "Icons regenerated:"
echo "  $BUILD/icon.icns"
echo "  $BUILD/icon.png"
echo "  $PUB/favicon.ico"
echo "  $PUB/apple-touch-icon.png"
