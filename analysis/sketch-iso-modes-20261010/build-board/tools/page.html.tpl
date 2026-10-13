<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=__W__, height=__H__"/>
<script src="gsap.min.js"></script><script src="theme.js"></script><script src="board-kit.js"></script><script src="puppet.js"></script>
<style>
@font-face{font-family:"Anton";src:url(fonts/anton-latin-400-normal.woff2)}
@font-face{font-family:"Inter";font-weight:800;src:url(fonts/inter-latin-800-normal.woff2)}
html,body{margin:0;background:#222}
#root{position:relative;width:__W__px;height:__H__px;overflow:hidden;font-family:Inter,sans-serif;background:var(--bg)}
</style>
</head><body>
<div id="root" data-composition-id="main" data-start="0" data-width="__W__" data-height="__H__" data-duration="__DUR__">
  <div id="pz" style="position:absolute;z-index:90" data-layout-allow-overlap data-layout-allow-occlusion data-layout-allow-overflow></div>
</div>
<script src="__SCENE__"></script>
<script>
window.__timelines = window.__timelines || {};
window.__timelines["main"] = window.SCENE();
</script>
</body></html>
