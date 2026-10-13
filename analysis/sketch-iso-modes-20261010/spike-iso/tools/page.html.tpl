<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=__W__, height=__H__"/>
<script src="gsap.min.js"></script><script src="theme.js"></script><script src="hl-geom.js"></script><script src="iso-kit.js"></script><script src="puppet.js"></script>
<style>
@font-face{font-family:"Anton";src:url(fonts/anton-latin-400-normal.woff2)}
@font-face{font-family:"Inter";font-weight:800;src:url(fonts/inter-latin-800-normal.woff2)}
html,body{margin:0;background:#222}
#root{position:relative;width:__W__px;height:__H__px;overflow:hidden;font-family:Inter,sans-serif;background:var(--bg)}
.lf-bg{position:absolute;inset:0;background-color:var(--bg);background-image:radial-gradient(circle at center,var(--dot) 0 2px,transparent 2.6px);background-size:40px 40px}
.iso-layer{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.lf-chip{font:400 44px/1 Anton,sans-serif;letter-spacing:.04em;color:var(--ink);background:var(--paper);border:6px solid var(--ink);border-radius:16px;box-shadow:8px 8px 0 var(--shadow);padding:12px 24px 8px;white-space:nowrap;text-transform:uppercase}
.lf-chip.marker{background:var(--marker)}.lf-chip.alert{background:var(--alert);color:var(--paper)}
</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-width="__W__" data-height="__H__" data-duration="45">
  <div class="lf-bg" data-layout-allow-overlap data-layout-allow-occlusion></div>
  <svg id="iso-under" class="iso-layer" width="__W__" height="__H__" style="z-index:3" data-board></svg>
  <svg id="iso" class="iso-layer" width="__W__" height="__H__" style="z-index:4" data-board></svg>
  <svg id="iso-over" class="iso-layer" width="__W__" height="__H__" style="z-index:5" data-board></svg>
  <div id="labels" style="position:absolute;inset:0;z-index:6;pointer-events:none" data-layout-allow-overlap data-layout-allow-occlusion data-layout-allow-overflow></div>
  <div id="pz" style="position:absolute;z-index:90" data-layout-allow-overlap data-layout-allow-occlusion data-layout-allow-overflow></div>
</div>
<script src="scene.js"></script>
<script>
window.__timelines = window.__timelines || {};
window.__timelines["main"] = window.ISO_SCENE();
</script>
</body></html>
