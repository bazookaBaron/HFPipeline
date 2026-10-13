#!/bin/sh
# copies shared files into comp/ (1920x1080) and comp-reel/ (1080x1920)
set -e
S=$(cd "$(dirname "$0")/.." && pwd); R=/c/Repos/HFPipleine/runtime
for d in comp:1920:1080 comp-reel:1080:1920; do
  n=${d%%:*}; wh=${d#*:}; w=${wh%%:*}; h=${wh#*:}
  mkdir -p "$S/$n/fonts"
  cp "$R/lf-outro/gsap.min.js" "$R/theme.js" "$R/puppet.js" "$S/$n/"
  cp "$R/lf-outro/fonts/anton-latin-400-normal.woff2" "$R/lf-outro/fonts/inter-latin-800-normal.woff2" "$S/$n/fonts/"
  cp "$S/vendor/hl-geom.js" "$S/iso-kit.js" "$S/scene.js" "$S/$n/"
  sed "s/__W__/$w/g; s/__H__/$h/g" "$S/tools/page.html.tpl" > "$S/$n/index.html"
done
echo ok
