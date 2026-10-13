#!/bin/sh
# builds comp-city/ and comp-parking/ (1920x1080, 30 s) from the runtime files + the demo scenes in this folder
set -e
S=$(cd "$(dirname "$0")/.." && pwd); R=/c/Repos/HFPipleine/runtime
for d in comp-city:1920:1080:30:city.js comp-parking:1920:1080:30:parking.js; do
  n=${d%%:*}; r=${d#*:}; w=${r%%:*}; r=${r#*:}; h=${r%%:*}; r=${r#*:}; dur=${r%%:*}; sc=${r#*:}
  mkdir -p "$S/$n/fonts"
  cp "$R/lf-outro/gsap.min.js" "$R/theme.js" "$R/puppet.js" "$S/$n/"
  cp "$R/lf-outro/fonts/anton-latin-400-normal.woff2" "$R/lf-outro/fonts/inter-latin-800-normal.woff2" "$S/$n/fonts/"
  cp "$R/vendor/hairline/hl-geom.js" "$R/iso/iso-kit.js" "$R/iso/worlds.js" "$S/$sc" "$S/$n/"
  sed "s/__W__/$w/g; s/__H__/$h/g; s/__DUR__/$dur/g; s/__SCENE__/$sc/g" "$S/tools/page.html.tpl" > "$S/$n/index.html"
done
echo ok
