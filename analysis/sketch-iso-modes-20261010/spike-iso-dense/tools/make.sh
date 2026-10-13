#!/bin/sh
# copies shared files into comp-city/ (1920x1080), comp-city-reel/ (1080x1920), comp-lot/ (1920x1080)
set -e
S=$(cd "$(dirname "$0")/.." && pwd); R=/c/Repos/HFPipleine/runtime
for d in comp-city:1920:1080:city.js comp-city-reel:1080:1920:city.js comp-lot:1920:1080:lot.js; do
  n=${d%%:*}; r=${d#*:}; w=${r%%:*}; r=${r#*:}; h=${r%%:*}; sc=${r#*:}
  mkdir -p "$S/$n/fonts"
  cp "$R/lf-outro/gsap.min.js" "$R/theme.js" "$R/puppet.js" "$S/$n/"
  cp "$R/lf-outro/fonts/anton-latin-400-normal.woff2" "$R/lf-outro/fonts/inter-latin-800-normal.woff2" "$S/$n/fonts/"
  cp "$S/vendor/hl-geom.js" "$S/world-kit.js" "$S/worlds.js" "$S/$sc" "$S/$n/"
  sed "s/__W__/$w/g; s/__H__/$h/g; s/__DUR__/40/g; s/__SCENE__/$sc/g" "$S/tools/page.html.tpl" > "$S/$n/index.html"
done
echo ok
