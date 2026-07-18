#!/usr/bin/env bash
# Regenerate every raster icon for both apps from the vector sources in
#   shared/assets/brand/
#     logo.svg      full logo (mark + wordmark), theme-adaptive
#     favicon.svg   circular badge, theme-adaptive (blue on light tabs, white on dark)
#     app-icon.svg  full logo on a white rounded tile (macOS dock icon)
#
# Outputs:
#   apps/web/public/  logo.svg, favicon.svg, favicon.ico, apple-touch-icon.png,
#                     icon-192.png, icon-512.png
#   apps/desktop/build/  icon.icns, icon.png
#
# Requires: rsvg-convert (brew install librsvg), iconutil (macOS), python3 + Pillow.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRAND="$ROOT/shared/assets/brand"
PUB="$ROOT/apps/web/public"
BUILD="$ROOT/apps/desktop/build"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1) Ship the vector sources the web app serves statically.
cp "$BRAND/logo.svg"    "$PUB/logo.svg"
cp "$BRAND/favicon.svg" "$PUB/favicon.svg"

# 2) Rasters rendered from those vectors.
rsvg-convert -w 256 -h 256 "$BRAND/favicon.svg" -o "$TMP/fav.png"   # light variant of the badge
rsvg-convert -w 1024        "$BRAND/logo.svg"    -o "$TMP/logo.png"  # full logo, transparent

# 3) macOS .icns from the white-tile app icon.
mkdir -p "$TMP/icon.iconset"
gen() { rsvg-convert -w "$1" -h "$1" "$BRAND/app-icon.svg" -o "$TMP/icon.iconset/$2"; }
gen 16 icon_16x16.png;    gen 32 icon_16x16@2x.png
gen 32 icon_32x32.png;    gen 64 icon_32x32@2x.png
gen 128 icon_128x128.png; gen 256 icon_128x128@2x.png
gen 256 icon_256x256.png; gen 512 icon_256x256@2x.png
gen 512 icon_512x512.png; gen 1024 icon_512x512@2x.png
iconutil -c icns "$TMP/icon.iconset" -o "$BUILD/icon.icns"
rsvg-convert -w 1024 -h 1024 "$BRAND/app-icon.svg" -o "$BUILD/icon.png"

# 4) favicon.ico + opaque app tiles (apple-touch / PWA) via Pillow.
python3 - "$TMP" "$PUB" <<'PY'
import sys
from PIL import Image
tmp, pub = sys.argv[1], sys.argv[2]
Image.open(f"{tmp}/fav.png").convert("RGBA").save(
    f"{pub}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
logo = Image.open(f"{tmp}/logo.png").convert("RGBA")
def tile(S, pad):
    w = S - 2 * pad
    h = round(w * logo.height / logo.width)
    if h > S - 2 * pad:
        h = S - 2 * pad
        w = round(h * logo.width / logo.height)
    lg = logo.resize((w, h), Image.LANCZOS)
    im = Image.new("RGBA", (S, S), (255, 255, 255, 255))
    im.alpha_composite(lg, ((S - w) // 2, (S - h) // 2))
    return im.convert("RGB")
tile(180, 26).save(f"{pub}/apple-touch-icon.png")
tile(192, 24).save(f"{pub}/icon-192.png")
tile(512, 64).save(f"{pub}/icon-512.png")
PY

echo "Regenerated brand assets:"
echo "  $PUB/{logo.svg, favicon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png}"
echo "  $BUILD/{icon.icns, icon.png}"
