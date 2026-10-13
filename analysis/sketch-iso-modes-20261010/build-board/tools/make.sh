#!/bin/sh
# builds comp-lf/ (1920x1080) and comp-reel/ (1080x1920), 30 s each, from runtime files + inflation.js
set -e
S=$(cd "$(dirname "$0")/.." && pwd); R=/c/Repos/HFPipleine/runtime
for d in comp-lf:1920:1080:30:inflation.js comp-reel:1080:1920:30:inflation.js; do
  n=${d%%:*}; r=${d#*:}; w=${r%%:*}; r=${r#*:}; h=${r%%:*}; r=${r#*:}; dur=${r%%:*}; sc=${r#*:}
  mkdir -p "$S/$n/fonts"
  cp "$R/lf-outro/gsap.min.js" "$R/theme.js" "$R/puppet.js" "$R/board/board-kit.js" "$S/$sc" "$S/$n/"
  cp "$R/lf-outro/fonts/anton-latin-400-normal.woff2" "$R/lf-outro/fonts/inter-latin-800-normal.woff2" "$S/$n/fonts/"
  sed "s/__W__/$w/g; s/__H__/$h/g; s/__DUR__/$dur/g; s/__SCENE__/$sc/g" "$S/tools/page.html.tpl" > "$S/$n/index.html"
done
echo ok
