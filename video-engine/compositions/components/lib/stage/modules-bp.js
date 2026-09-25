/*
 * HFStage BP cards (ref R6, analysis/pacing-audit-20260924/design/R6/AUDIT.md §5). Mechanics and
 * measurements only (no R6 character, assets or logos). Seek-safe: every change is a tl.set or a
 * finite tween at an explicit time; no repeats, no randomness.
 *
 *   blueprint      §5.4  persistent growing architecture graph: tiers + bus routing + groups,
 *                        add / connect / alert / crash / clear / light / annotate / unannotate /
 *                        packet / version / refit (auto zoom-to-fit when it grows); recalled across
 *                        scaffolds with its accumulated state (same module id)
 *   featureRows    §5.14 ghost -> lit rows (icon tile 72, title cap 28, mono sub, right mini-visual)
 *   costCards      §5.14 ghost -> lit trade-off cards (name, red consequence, mini-visual)
 *   techCards      §5.14 2x2 ghost -> lit tech cards + tumble
 *   displayHeadline §5.15 left-aligned caps headline, cuts in dim #5A6269, lit -> ink, accents red
 *   strikeStrips   §5.16 "isn't / it's" pair, strike 6 px 333 ms power2.inOut (E13)
 *   verdictStamp   §5.18 stamp v2: -5 deg, 3 px border, slam 1.30 -> 1.0 in 167 ms power2.out (E10)
 *   phone          §5.7  device mockup 330x675, screens blank / feed / post, timer, progress
 *   reqList        §5.8  dashed request / job rows lit per word (blue / red), total row
 *   dotGrid        §5.9  5x20 dots: raster fill (1.0 s linear), mark, recolour sweep
 *   hitCounter     §5.9  avatar + handle + route pill + big counter
 *   vsCards        §5.9  2 dashed compare cards, winner lit
 *   latencyBars    §5.13 labelled bars + value + footer
 *   logoGrid       §5.18 6-col tiles, accelerating pop-in + counter
 *   imageSlot      §5.19 circle / rounded image (or initials), ring, play disc
 *   jargonCloud    §5.6  tilted term chips: drop (back.out from 1.16), flood, scatter
 */
(function (global) {
  "use strict";
  var HF = (global.HFStage = global.HFStage || { modules: {} });
  var M = HF.modules;
  var SVG = "http://www.w3.org/2000/svg";
  var F = 1 / 30;
  var SANS = "Inter, ui-sans-serif, system-ui, sans-serif";
  var MONO = "'JetBrains Mono', ui-monospace, monospace";

  var CSS = [
    // ---- shared BP card skin ----
    "html .st-bpc{background:#fff;border:1.5px solid #dbdfe1;border-radius:12px;box-shadow:0 8px 20px rgba(24,34,44,.06);}",
    "html .bp-ghost{background:rgba(255,255,255,.35);border:1.5px dashed #c5c9cb;box-shadow:none;}",
    "html .bp-ghost[data-lit='1']{background:#fff;border:1.5px solid #dbdfe1;box-shadow:0 8px 20px rgba(24,34,44,.06);}",
    "html .bp-ghost .gt{color:#64686c;}html .bp-ghost[data-lit='1'] .gt{color:#141920;}",
    "html .bp-ghost .gv{opacity:.35;}html .bp-ghost[data-lit='1'] .gv{opacity:1;}",
    "html .bp-ghost .gi{background:#eef0f1 !important;color:#9aa0a6 !important;}",
    "html .bp-ghost[data-lit='1'] .gi{background:var(--gi-bg) !important;color:var(--gi-fg) !important;}",
    "html .bp-ghost .gr{color:#8a8f94;}html .bp-ghost[data-lit='1'] .gr{color:#ae2435;}",
    "html .bp-mono{font-family:" + MONO + ";}",
    "html .bp-eyebrow{font-family:" + MONO + ";font-size:17px;font-weight:600;letter-spacing:.1em;color:#6b7075;text-transform:uppercase;white-space:nowrap;display:flex;align-items:center;gap:8px;}",
    "html .bp-chip{display:inline-flex;align-items:center;height:34px;padding:0 10px;border-radius:8px;border:1.5px solid var(--cl,#dbdfe1);background:var(--cf,#f5f7f8);color:var(--ca,#141920);font-family:" + MONO + ";font-size:16px;font-weight:700;letter-spacing:.02em;white-space:nowrap;}",
    "html .bp-vis{position:absolute;display:flex;align-items:center;gap:8px;}",
    // ---- blueprint host ----
    "html .st-blueprint{background:#fff;border:1.5px solid #dbdfe1;border-radius:12px;box-shadow:0 10px 24px rgba(24,34,44,.07);overflow:hidden;}",
    "html .st-blueprint .bp-bar{position:absolute;left:0;right:0;top:0;height:42px;border-bottom:1.5px solid #dee0e0;display:flex;align-items:center;gap:10px;padding:0 16px;font-family:" + MONO + ";font-size:15px;font-weight:500;letter-spacing:.12em;color:#6b7075;text-transform:uppercase;white-space:nowrap;background:#fff;z-index:2;}",
    "html .st-blueprint .bp-ver{margin-left:auto;background:#efeafb;color:#5b32d6;font-weight:700;border-radius:6px;padding:2px 9px;letter-spacing:.04em;}",
    "html .st-blueprint .bp-body{position:absolute;left:0;right:0;top:43.5px;bottom:0;overflow:hidden;background-color:#fff;background-image:linear-gradient(#f0f3f4 1px,transparent 1px),linear-gradient(90deg,#f0f3f4 1px,transparent 1px);background-size:24px 24px;}",
    "html .st-blueprint .bp-world{position:absolute;left:0;top:0;transform-origin:0 0;}",
    "html .st-blueprint .bp-world > svg{position:absolute;left:0;top:0;overflow:visible;}",
    "html .bp-node{position:absolute;box-sizing:border-box;background:#fff;border:1.5px solid #d4d8db;border-radius:10px;box-shadow:0 4px 10px rgba(24,34,44,.07);display:flex;flex-direction:column;align-items:center;justify-content:center;}",
    "html .bp-node .ic{width:38px;height:38px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#141920;margin-bottom:8px;flex:none;}",
    "html .bp-node .ic img{width:30px;height:30px;object-fit:contain;}",
    "html .bp-node .lb{font-weight:800;font-size:22px;letter-spacing:.01em;text-transform:uppercase;color:#141920;white-space:nowrap;line-height:1.1;}",
    "html .bp-node .sb{font-family:" + MONO + ";font-size:14px;color:#6b7075;white-space:nowrap;margin-top:4px;}",
    "html .bp-node .xx{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;display:none;color:#e2464b;}",
    "html .bp-node[data-state=alert]{background:#fbe6e6;border-color:#e2464b;box-shadow:0 0 0 6px rgba(226,70,75,.16);}",
    "html .bp-node[data-state=alert] .lb,html .bp-node[data-state=crash] .lb{color:#ae2435;}",
    "html .bp-node[data-state=crash]{background:#fbe6e6;border-color:#e2464b;}html .bp-node[data-state=crash] .xx{display:block;}",
    "html .bp-node[data-state=crash] .ic,html .bp-node[data-state=crash] .sb{opacity:.35;}",
    "html .bp-node[data-state=lit]{border-color:#7643ff;box-shadow:0 0 0 4px rgba(118,67,255,.14);}",
    "html .bp-node[data-state=ok]{background:#e0f3e6;border-color:#7cc497;}",
    "html .bp-node.users{flex-direction:row;justify-content:flex-start;border-radius:44px;padding:0 26px 0 18px;gap:0;}",
    "html .bp-node.users .av{width:50px;height:50px;border-radius:50%;border:2.5px solid #fff;margin-right:-12px;flex:none;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:19px;color:#fff;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12);}",
    "html .bp-node.users .av img{width:100%;height:100%;object-fit:cover;}",
    "html .bp-node.users .av.plus{background:#e3ebf9;color:#1f4dbd;font-size:26px;font-weight:600;}",
    "html .bp-node.users .ut{margin-left:28px;display:flex;flex-direction:column;align-items:flex-start;}",
    "html .bp-node.users .sb{margin-top:3px;}",
    "html .bp-node.machine{justify-content:flex-start;align-items:stretch;padding:0 16px;border-radius:12px;}",
    "html .bp-node.machine .mh{height:46px;display:flex;align-items:center;gap:10px;font-family:" + MONO + ";font-size:15px;letter-spacing:.12em;color:#6b7075;text-transform:uppercase;border-bottom:1.5px solid #e3e7e9;white-space:nowrap;}",
    "html .bp-node.machine .mr{height:62px;display:flex;align-items:center;gap:14px;border-bottom:1.5px solid #eef0f1;}",
    "html .bp-node.machine .mr:last-child{border-bottom:0;}",
    "html .bp-node.machine .mr .lb{font-size:24px;}html .bp-node.machine .mr .sb{margin:0 0 0 auto;}",
    "html .bp-badge{background:#5b32d6;color:#fff;font-family:" + MONO + ";font-size:14px;font-weight:700;border-radius:6px;padding:3px 7px;margin-left:12px;flex:none;}",
    "html .bp-node.machine .mh .bp-badge{margin-left:auto;}",
    "html .bp-group{position:absolute;border:1.5px dashed #9b7bff;border-radius:12px;}",
    "html .bp-group .gl{position:absolute;left:12px;top:-13px;background:#fff;border:1.5px solid #c9b8f7;border-radius:6px;padding:0 8px;height:24px;display:flex;align-items:center;font-family:" + MONO + ";font-size:13px;font-weight:600;letter-spacing:.08em;color:#5b32d6;white-space:nowrap;text-transform:uppercase;}",
    "html .bp-ann{position:absolute;height:38px;display:flex;align-items:center;gap:8px;padding:0 14px;border-radius:10px;border:1.5px solid var(--al);background:var(--af);color:var(--ac);font-family:" + MONO + ";font-size:16px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;box-sizing:border-box;}",
    "html .bp-pkt{position:absolute;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;box-shadow:0 0 0 3px rgba(118,67,255,.18);}",
    // ---- ghost -> lit rows / cards ----
    "html .bp-fr{position:absolute;left:0;right:0;border-radius:12px;}",
    "html .bp-fr .gi{position:absolute;left:24px;top:50%;margin-top:-36px;width:72px;height:72px;border-radius:14px;display:flex;align-items:center;justify-content:center;}",
    "html .bp-fr .t{position:absolute;left:120px;font-weight:800;letter-spacing:-.005em;text-transform:uppercase;white-space:nowrap;line-height:1.05;}",
    "html .bp-fr .s{position:absolute;left:121px;font-family:" + MONO + ";font-size:17px;color:#6b7075;white-space:nowrap;}",
    "html .bp-cc{position:absolute;left:0;right:0;border-radius:12px;}",
    "html .bp-cc .hd{position:absolute;left:24px;top:22px;display:flex;align-items:center;gap:12px;font-weight:800;font-size:24px;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;}",
    "html .bp-cc .gi{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none;}",
    "html .bp-cc .cq{position:absolute;left:24px;font-weight:800;letter-spacing:-.01em;text-transform:uppercase;line-height:1.05;}",
    "html .bp-tc{position:absolute;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;}",
    "html .bp-tc .gi{width:104px;height:104px;border-radius:20px;display:flex;align-items:center;justify-content:center;}",
    "html .bp-tc .t{font-weight:800;letter-spacing:-.005em;text-transform:uppercase;white-space:nowrap;}",
    "html .bp-tc .s{font-family:" + MONO + ";font-size:17px;color:#6b7075;white-space:nowrap;}",
    // ---- display headline ----
    "html .st-displayHeadline .dl{display:block;font-weight:800;letter-spacing:-.02em;text-transform:uppercase;white-space:nowrap;color:#5a6269;line-height:1;}",
    "html .st-displayHeadline .dl span{display:inline;}",
    // ---- strike strips ----
    "html .bp-ss{position:absolute;left:0;right:0;border-radius:12px;}",
    "html .bp-ss .e{position:absolute;left:28px;top:24px;font-family:" + MONO + ";font-size:18px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;}",
    "html .bp-ss .x{position:absolute;left:28px;font-weight:800;font-size:44px;letter-spacing:-.01em;text-transform:uppercase;white-space:nowrap;line-height:1;}",
    "html .bp-ss .ln{position:absolute;height:7px;border-radius:4px;background:#e8474e;transform-origin:0 50%;}",
    "html .bp-ss.no{background:#fff;border:1.5px solid #f6dbe0;}html .bp-ss.no .e{color:#ae2435;}html .bp-ss.no .x{color:#141920;}",
    "html .bp-ss.yes .e{color:#1d7a4f;}html .bp-ss.yes[data-lit='1']{background:#e0f3e6;border:1.5px solid #a7d5b6;}html .bp-ss.yes[data-lit='1'] .x{color:#155f3d;}",
    // ---- verdict stamp ----
    "html .st-verdictStamp{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:28px;}",
    "html .st-verdictStamp .sp{border:4.5px solid #ae2435;border-radius:14px;background:#fff;color:#891e2f;font-weight:900;letter-spacing:-.005em;text-transform:uppercase;text-align:center;line-height:1.02;padding:22px 40px;transform:rotate(-5deg);white-space:nowrap;box-shadow:0 10px 24px rgba(24,34,44,.08);}",
    "html .st-verdictStamp[data-tone=green] .sp{border-color:#1d7a4f;color:#155f3d;}html .st-verdictStamp[data-tone=amber] .sp{border-color:#a15c00;color:#7a4500;}",
    "html .st-verdictStamp .sub{font-weight:600;font-size:30px;color:#3a3f45;white-space:nowrap;}",
    // ---- phone ----
    "html .bp-ph{position:absolute;left:0;top:0;border-radius:48px;background:#15181c;box-shadow:0 14px 30px rgba(24,34,44,.16);}",
    "html .bp-ph .scr{position:absolute;left:12px;top:12px;right:12px;bottom:12px;border-radius:37px;background:#fff;overflow:hidden;}",
    "html .bp-ph .notch{position:absolute;left:50%;top:14px;width:96px;height:28px;margin-left:-48px;border-radius:14px;background:#15181c;z-index:3;}",
    "html .bp-ph .clock{position:absolute;left:28px;top:17px;font-weight:700;font-size:16px;color:#141920;z-index:3;}",
    "html .bp-ph .sv{position:absolute;left:0;right:0;top:0;bottom:0;}",
    "html .bp-ph .ab{position:absolute;left:18px;right:18px;top:54px;height:40px;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:22px;color:#141920;white-space:nowrap;}",
    "html .bp-ph .ab .r{font-size:18px;font-weight:700;color:#1f4dbd;}",
    "html .bp-ph .med{position:absolute;left:14px;right:14px;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#f7b267 0%,#f79d65 34%,#5f8fb4 36%,#2f5e86 100%);}",
    "html .bp-ph .med img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;}",
    "html .bp-ph .play{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;}",
    "html .bp-ph .dur{position:absolute;right:10px;bottom:8px;font-family:" + MONO + ";font-size:13px;color:#fff;background:rgba(0,0,0,.45);border-radius:5px;padding:1px 6px;}",
    "html .bp-ph .cap{position:absolute;left:18px;right:18px;font-size:16px;font-weight:500;color:#26292e;white-space:nowrap;overflow:hidden;}",
    "html .bp-ph .who{position:absolute;left:18px;right:18px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;color:#141920;white-space:nowrap;}",
    "html .bp-ph .who i{width:34px;height:34px;border-radius:50%;background:#c9b8f7;display:block;flex:none;}",
    "html .bp-ph .file{position:absolute;left:14px;right:14px;height:44px;border-radius:10px;background:#f3f5f6;display:flex;align-items:center;gap:10px;padding:0 12px;font-family:" + MONO + ";font-size:14px;color:#26292e;white-space:nowrap;}",
    "html .bp-ph .file .z{margin-left:auto;}",
    "html .bp-ph .prog{position:absolute;left:14px;right:14px;height:7px;border-radius:4px;background:#e3e7e9;overflow:hidden;}",
    "html .bp-ph .prog i{position:absolute;left:0;top:0;bottom:0;width:100%;background:#2d6be0;transform-origin:0 50%;display:block;}",
    "html .bp-ph .proc{position:absolute;left:14px;right:14px;height:56px;border-radius:12px;border:1.5px solid #dbdfe1;display:flex;align-items:center;gap:12px;padding:0 14px;font-size:16px;color:#26292e;white-space:nowrap;}",
    "html .bp-ph .proc b{margin-left:auto;font-family:" + MONO + ";font-size:24px;font-weight:800;color:#141920;}",
    "html .bp-ph .spin{width:22px;height:22px;border-radius:50%;border:3px solid #dbe4f5;border-top-color:#2d6be0;flex:none;}",
    "html .bp-ph .skel{position:absolute;left:18px;height:14px;border-radius:7px;background:#eef0f1;}",
    "html .bp-ph .acts{position:absolute;left:18px;display:flex;gap:16px;color:#26292e;}",
    // ---- request / job list ----
    "html .bp-rl-row{position:absolute;left:18px;right:18px;border-radius:9px;border:1.5px dashed #c5c9cb;display:flex;align-items:center;gap:12px;padding:0 14px;white-space:nowrap;overflow:hidden;}",
    "html .bp-rl-row .vb{font-family:" + MONO + ";font-weight:800;font-size:17px;color:#6b7075;}",
    "html .bp-rl-row .pa{font-family:" + MONO + ";font-size:17px;color:#3a3f45;}",
    "html .bp-rl-row .lb{font-weight:700;font-size:19px;letter-spacing:.01em;text-transform:uppercase;color:#4a4f55;}",
    "html .bp-rl-row .va{margin-left:auto;font-family:" + MONO + ";font-size:18px;font-weight:700;color:#4a4f55;}",
    "html .bp-rl-row .ri{color:#6b7075;display:flex;}",
    "html .bp-rl-row[data-tone=blue]{border-style:solid;border-color:#1f4dbd;background:#e3ebf9;}html .bp-rl-row[data-tone=blue] .vb,html .bp-rl-row[data-tone=blue] .lb,html .bp-rl-row[data-tone=blue] .va,html .bp-rl-row[data-tone=blue] .ri{color:#1f4dbd;}",
    "html .bp-rl-row[data-tone=red]{border-style:solid;border-color:#e2464b;background:#fbe6e6;}html .bp-rl-row[data-tone=red] .vb,html .bp-rl-row[data-tone=red] .lb,html .bp-rl-row[data-tone=red] .va,html .bp-rl-row[data-tone=red] .ri{color:#ae2435;}",
    "html .bp-rl-row[data-tone=green]{border-style:solid;border-color:#7cc497;background:#e0f3e6;}html .bp-rl-row[data-tone=green] .vb,html .bp-rl-row[data-tone=green] .lb,html .bp-rl-row[data-tone=green] .va{color:#155f3d;}",
    "html .bp-rl-tot{position:absolute;left:18px;right:18px;border-radius:9px;border:1.5px dashed #c5c9cb;display:flex;align-items:center;padding:0 16px;white-space:nowrap;}",
    "html .bp-rl-tot .lb{font-family:" + MONO + ";font-size:16px;font-weight:600;letter-spacing:.08em;color:#4a4f55;text-transform:uppercase;}",
    "html .bp-rl-tot .va{margin-left:auto;font-family:" + MONO + ";font-size:34px;font-weight:800;color:#4a4f55;}",
    "html .bp-rl-tot[data-tone=red]{background:#af2231;border:1.5px solid #af2231;}html .bp-rl-tot[data-tone=red] .lb,html .bp-rl-tot[data-tone=red] .va{color:#fff;}",
    // ---- dot grid / counters / vs ----
    "html .bp-dot{position:absolute;border-radius:5px;background:#e6e9eb;}",
    "html .bp-big{font-family:" + MONO + ";font-weight:800;letter-spacing:-.02em;white-space:nowrap;line-height:1;}",
    "html .bp-vs{position:absolute;top:0;bottom:0;border-radius:12px;}",
    "html .bp-vs .hd{position:absolute;left:24px;top:24px;right:18px;display:flex;align-items:center;gap:12px;font-weight:800;font-size:26px;text-transform:uppercase;white-space:nowrap;}",
    "html .bp-vs .su{position:absolute;left:24px;top:74px;font-family:" + MONO + ";font-size:16px;color:#6b7075;white-space:nowrap;}",
    "html .bp-vs .v{position:absolute;left:24px;color:#8a8f94;}html .bp-vs[data-lit='1'] .v{color:#5b32d6;}",
    "html .bp-vs .lab{position:absolute;left:24px;font-weight:800;font-size:18px;letter-spacing:.06em;text-transform:uppercase;color:#64686c;white-space:nowrap;}",
    "html .bp-vs .ft{position:absolute;left:24px;bottom:22px;font-family:" + MONO + ";font-size:16px;color:#6b7075;white-space:nowrap;}",
    // ---- latency bars ----
    "html .bp-lb .l{position:absolute;left:24px;font-weight:800;font-size:22px;letter-spacing:.01em;text-transform:uppercase;color:#141920;white-space:nowrap;}",
    "html .bp-lb .tk{position:absolute;left:24px;height:30px;border-radius:15px;background:#f1f3f4;overflow:hidden;}",
    "html .bp-lb .fl{position:absolute;left:0;top:0;bottom:0;border-radius:15px;transform-origin:0 50%;}",
    "html .bp-lb .v{position:absolute;right:24px;font-family:" + MONO + ";font-size:28px;font-weight:800;white-space:nowrap;}",
    "html .bp-lb .ft{position:absolute;left:24px;right:24px;bottom:0;height:58px;border-top:1.5px solid #e3e7e9;display:flex;align-items:center;font-family:" + MONO + ";font-size:16px;color:#6b7075;white-space:nowrap;}",
    // ---- logo grid ----
    "html .bp-tile{position:absolute;width:105px;height:105px;border-radius:12px;background:#fff;border:1.5px solid #dbdfe1;box-shadow:0 4px 10px rgba(24,34,44,.06);display:flex;align-items:center;justify-content:center;color:#141920;font-family:" + MONO + ";font-weight:800;font-size:18px;}",
    "html .bp-tile img{width:52px;height:52px;object-fit:contain;}",
    // ---- image slot ----
    "html .st-imageSlot .im{position:absolute;left:0;top:0;width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;}",
    "html .st-imageSlot .im img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;}",
    "html .st-imageSlot[data-shape=circle] .im{border-radius:50%;}html .st-imageSlot[data-shape=rounded] .im{border-radius:12px;}",
    "html .st-imageSlot[data-ring='1'] .im{box-shadow:0 0 0 3px #fff,0 2px 8px rgba(0,0,0,.15);}",
    "html .st-imageSlot .play{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;}",
    "html .st-imageSlot .cp{position:absolute;left:12px;bottom:10px;font-family:" + MONO + ";font-size:15px;font-weight:700;color:#fff;background:rgba(0,0,0,.5);border-radius:6px;padding:2px 8px;white-space:nowrap;}",
    // ---- jargon cloud ----
    "html .bp-jc{position:absolute;display:flex;align-items:center;gap:14px;background:#fff;border:1.5px solid #dbdfe1;border-radius:14px;box-shadow:0 8px 18px rgba(24,34,44,.08);padding:0 20px 0 14px;white-space:nowrap;font-weight:800;text-transform:uppercase;color:#141920;}",
    "html .bp-jc .gi{border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;flex:none;}",
    "html .bp-jc.sm{padding:0 14px 0 10px;gap:9px;border-radius:10px;font-size:18px;}",
  ].join("\n");
  (function () {
    if (document.getElementById("st-bp-mod-style")) return;
    var st = document.createElement("style");
    st.id = "st-bp-mod-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  })();

  // ------------------------------------------------------------------ helpers
  function div(cls, parent, text) {
    var el = document.createElement("div");
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    if (parent) parent.appendChild(el);
    return el;
  }
  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    if (parent) parent.appendChild(el);
    return el;
  }
  function W(el) {
    return parseFloat(el.style.width);
  }
  function H(el) {
    return parseFloat(el.style.height);
  }
  function measure(text, weight, size, family) {
    if (global.HFTextFit) return global.HFTextFit.measure(String(text), weight, size, family || SANS);
    return String(text).length * size * 0.62;
  }
  function fitSize(text, weight, size, maxW, min, family) {
    var s = size;
    while (s > (min || 12) && measure(text, weight, s, family) > maxW) s -= 1;
    return s;
  }
  var ICON_NAMES = function () {
    return (global.HFIcons && global.HFIcons.names) || [];
  };
  /** icon: HFIcons name, BP glyph name, or an image src (anything with / or .) */
  function iconNode(name, size) {
    if (!name) return null;
    if (/[\/.]/.test(String(name))) {
      var im = document.createElement("img");
      im.src = name;
      im.alt = "";
      return im;
    }
    if (ICON_NAMES().indexOf(name) >= 0) {
      var s = global.HFIcons.create(name, { size: size });
      s.setAttribute("stroke-width", "2");
      return s;
    }
    if (HF.bpGlyph) return HF.bpGlyph(name, size);
    return null;
  }
  function tone(t, fb) {
    return HF.tone(t) || fb;
  }
  function tintOf(t) {
    return HF.tint(t) || ["#f5f7f8", "#dbdfe1"];
  }
  function chipRow(parent, items, x, y, alignRight, rightEdge) {
    var row = div("bp-vis gv", parent);
    (items || []).forEach(function (it) {
      var o = typeof it === "string" ? { text: it } : it || {};
      var ch = div("bp-chip", row, o.text);
      if (o.tone) {
        var tt = tintOf(o.tone);
        ch.style.setProperty("--cf", tt[0]);
        ch.style.setProperty("--cl", tt[1]);
        ch.style.setProperty("--ca", tone(o.tone, "#141920"));
      }
      if (o.plain) {
        ch.style.background = "transparent";
        ch.style.border = "0";
        ch.style.padding = "0 2px";
        ch.style.color = "#6b7075";
      }
    });
    if (alignRight) row.style.right = rightEdge + "px";
    else row.style.left = x + "px";
    row.style.top = y + "px";
    return row;
  }
  function chipsWidth(items) {
    return (items || []).reduce(function (a, it) {
      var o = typeof it === "string" ? { text: it } : it || {};
      return a + measure(o.text || "", 700, 16, MONO) + (o.plain ? 4 : 23) + 8;
    }, 0);
  }
  function initials(s) {
    return String(s || "?")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (w) {
        return w[0].toUpperCase();
      })
      .join("") || "?";
  }
  var AV = ["#7643ff", "#1f4dbd", "#1d7a4f", "#c2521c", "#b0306a", "#1f6f8b", "#a15c00"];
  function pop(tl, el, t, from) {
    tl.fromTo(el, { scale: from || 1.03 }, { scale: 1, duration: 4 * F, ease: "power2.out", immediateRender: false }, t);
  }

  // ================================================================== blueprint (§5.4)
  // props {title, version?, fit?: "auto"|"manual", final?: true (everything shown, for the hook),
  //   nodes: [{id, kind?: node|users|machine, icon?, tone?, label, sub?, row, x? (0-1), hidden?,
  //            rows?: [{icon, label, sub?, badge?}] (machine), badge?, avatars?: [src|name] (users)}],
  //   edges: [{from, to, style?: solid|dashed|replica, route?: bus|side, hidden?}],
  //   groups: [{id, label, nodes: [ids], hidden? (default true)}]}
  var ROW_GAP = 70;
  var COL_GAP = 36;
  var MAX_SCALE = 1.2;
  var ANN = {
    purple: ["#efeafb", "#c9b8f7", "#5b32d6"],
    green: ["#e0f3e6", "#a7d5b6", "#196549"],
    red: ["#fbe6e6", "#eeb4b9", "#ae2435"],
    blue: ["#e3ebf9", "#b3c6ee", "#1f4dbd"],
    amber: ["#fcf3e3", "#e6c98f", "#8a4f00"],
    grey: ["#f4f6f7", "#dbdfe1", "#4a4f55"],
  };

  function nodeSize(n) {
    var label = String(n.label || n.id).toUpperCase();
    var sub = n.sub ? String(n.sub) : "";
    if (n.kind === "users") {
      var nav = Math.min(5, (n.avatars || []).length || 4);
      var lw = Math.max(measure(label, 800, 24), sub ? measure(sub, 500, 14, MONO) : 0);
      return { w: Math.round(18 + nav * 38 + 12 + 50 + 28 + lw + 30), h: 92 };
    }
    if (n.kind === "machine") {
      var rows = n.rows || [];
      var mw = rows.reduce(function (a, r) {
        return Math.max(a, 16 + 32 + 14 + measure(String(r.label || "").toUpperCase(), 800, 24) + 20 + (r.sub ? measure(r.sub, 500, 14, MONO) : 0) + (r.badge ? 48 : 0) + 16);
      }, measure(label, 500, 15, MONO) * 1.12 + 110);
      return { w: Math.round(Math.max(380, mw)), h: 46 + rows.length * 62 + 6 };
    }
    var w = Math.max(150, measure(label, 800, 22) + 40, sub ? measure(sub, 500, 14, MONO) + 36 : 0);
    return { w: Math.round(w), h: 14 + 38 + 8 + 24 + (sub ? 22 : 0) + 14 };
  }

  function layoutGraph(p) {
    var nodes = p.nodes || [];
    var box = {};
    var rowOf = {};
    nodes.forEach(function (n, i) {
      var r = n.row;
      if (r === undefined || r === null) {
        var parent = (p.edges || []).find(function (e) {
          return e.to === n.id && rowOf[e.from] !== undefined;
        });
        r = parent ? rowOf[parent.from] + 1 : i === 0 ? 0 : rowOf[nodes[i - 1].id];
      }
      rowOf[n.id] = Number(r);
    });
    var rows = Object.keys(
      nodes.reduce(function (a, n) {
        a[rowOf[n.id]] = 1;
        return a;
      }, {})
    )
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });
    var sizes = {};
    nodes.forEach(function (n) {
      sizes[n.id] = nodeSize(n);
    });
    // nodes with an explicit x (0-1 of the world width) are placed there; the rest of a row packs
    // centred (a node that a later version replaces can share the space of its successors)
    var packed = function (n) {
      return typeof n.x !== "number";
    };
    var rowW = rows.map(function (r) {
      var ns = nodes.filter(function (n) {
        return rowOf[n.id] === r && packed(n);
      });
      return ns.reduce(function (a, n) {
        return a + sizes[n.id].w;
      }, 0) + COL_GAP * Math.max(0, ns.length - 1);
    });
    var worldW = Math.max(560, Math.max.apply(null, rowW.concat([0])));
    var y = 0;
    var rowBand = {};
    rows.forEach(function (r, ri) {
      var ns = nodes.filter(function (n) {
        return rowOf[n.id] === r;
      });
      var hmax = Math.max.apply(null, ns.map(function (n) { return sizes[n.id].h; }));
      var x = (worldW - rowW[ri]) / 2;
      ns.forEach(function (n) {
        var s = sizes[n.id];
        var cx = packed(n) ? x + s.w / 2 : n.x * worldW;
        box[n.id] = { x: cx - s.w / 2, y: y + (hmax - s.h) / 2, w: s.w, h: s.h, row: r, ri: ri };
        if (packed(n)) x += s.w + COL_GAP;
      });
      rowBand[r] = { top: y, bottom: y + hmax, ri: ri };
      y += hmax + ROW_GAP;
    });
    return { box: box, rows: rows, rowBand: rowBand, worldW: worldW, worldH: Math.max(0, y - ROW_GAP) };
  }

  /** orthogonal route between two node boxes: {d, pts} in world px */
  function routeEdge(e, L) {
    var a = L.box[e.from];
    var b = L.box[e.to];
    if (!a || !b) return null;
    if (a.row === b.row) {
      var l = a.x < b.x ? a : b;
      var r = l === a ? b : a;
      var y1 = l.y + l.h / 2;
      var y2 = r.y + r.h / 2;
      var mx = (l.x + l.w + r.x) / 2;
      var pts = Math.abs(y1 - y2) < 1 ? [[l.x + l.w, y1], [r.x, y1]] : [[l.x + l.w, y1], [mx, y1], [mx, y2], [r.x, y2]];
      if (l !== a) pts.reverse();
      return pts;
    }
    var up = a.row > b.row;
    var top = up ? b : a;
    var bot = up ? a : b;
    var route = e.route || (Math.abs(bot.ri - top.ri) > 1 ? "side" : "bus");
    var pts2;
    if (route === "side") {
      var cxTop = top.x + top.w / 2;
      var left = cxTop < L.worldW / 2;
      var lane = left ? Infinity : -Infinity;
      Object.keys(L.box).forEach(function (id) {
        var k = L.box[id];
        if (k.ri < top.ri || k.ri > bot.ri) return;
        lane = left ? Math.min(lane, k.x) : Math.max(lane, k.x + k.w);
      });
      lane = left ? lane - 30 : lane + 30;
      var sx = left ? top.x : top.x + top.w;
      var ex = left ? bot.x : bot.x + bot.w;
      pts2 = [[sx, top.y + top.h / 2], [lane, top.y + top.h / 2], [lane, bot.y + bot.h / 2], [ex, bot.y + bot.h / 2]];
    } else {
      var x1 = top.x + top.w / 2;
      var yb = top.y + top.h;
      var x2 = bot.x + bot.w / 2;
      var my = L.rowBand[top.row].bottom + ROW_GAP / 2;
      pts2 = Math.abs(x1 - x2) < 1 ? [[x1, yb], [x2, bot.y]] : [[x1, yb], [x1, my], [x2, my], [x2, bot.y]];
    }
    if (up) pts2.reverse();
    return pts2;
  }
  function ptsToD(pts) {
    return pts
      .map(function (q, i) {
        return (i ? "L " : "M ") + q[0].toFixed(1) + " " + q[1].toFixed(1);
      })
      .join(" ");
  }
  function ptsLen(pts) {
    var s = 0;
    for (var i = 1; i < pts.length; i++) s += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    return s;
  }
  function ptAt(pts, d) {
    for (var i = 1; i < pts.length; i++) {
      var seg = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      if (d <= seg || i === pts.length - 1) {
        var k = seg ? Math.min(1, d / seg) : 0;
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      }
      d -= seg;
    }
    return pts[pts.length - 1];
  }

  M.blueprint = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-blueprint");
      var w = W(el);
      var h = H(el);
      var tl = c.tl;
      var bar = div("bp-bar", el);
      if (HF.bpGlyph) bar.appendChild(HF.bpGlyph("rule", 18));
      c.entity("title", div("", bar, p.title || "BLUEPRINT"));
      var ver = c.entity("version", div("bp-ver", bar, "V" + (p.version || 0)));
      if (p.version === undefined || p.version === null) ver.style.visibility = "hidden";
      var body = div("bp-body", el);
      var bodyH = h - 43.5;
      var world = div("bp-world", body);
      var L = layoutGraph(p);
      var FINAL = !!p.final;
      world.style.width = L.worldW + "px";
      world.style.height = L.worldH + "px";
      var gLayer = div("", world);
      var svg = svgEl("svg", { width: L.worldW, height: Math.max(1, L.worldH) }, world);
      var pktLayer = div("", world);
      var nLayer = div("", world);
      var aLayer = div("", world);

      var visible = {};
      var nodeEls = {};
      (p.nodes || []).forEach(function (n, ni) {
        var b = L.box[n.id];
        var ne = div("bp-node", nLayer);
        Object.assign(ne.style, { left: b.x + "px", top: b.y + "px", width: b.w + "px", height: b.h + "px" });
        var label = String(n.label || n.id).toUpperCase();
        if (n.kind === "users") {
          ne.classList.add("users");
          var avs = n.avatars && n.avatars.length ? n.avatars.slice(0, 5) : ["A", "K", "M", "R"];
          avs.forEach(function (a, i) {
            var av = div("av", ne);
            if (/[\/.]/.test(String(a))) {
              var im = document.createElement("img");
              im.src = a;
              im.alt = "";
              av.appendChild(im);
            } else {
              av.textContent = String(a).slice(0, 1).toUpperCase();
              av.style.background = AV[(i + ni) % AV.length];
            }
          });
          div("av plus", ne, "+");
          var ut = div("ut", ne);
          c.entity(n.id + ".label", div("lb", ut, label));
          if (n.sub) c.entity(n.id + ".sub", div("sb", ut, n.sub));
        } else if (n.kind === "machine") {
          ne.classList.add("machine");
          var mh = div("mh", ne);
          var mic = iconNode(n.icon || "server", 18);
          if (mic) mh.appendChild(mic);
          c.entity(n.id + ".label", div("", mh, label));
          if (n.badge) div("bp-badge", mh, n.badge);
          (n.rows || []).forEach(function (r, ri) {
            var mr = div("mr", ne);
            var ic = iconNode(r.icon || "server", 30);
            if (ic) mr.appendChild(ic);
            c.entity(n.id + ".r" + (ri + 1), div("lb", mr, String(r.label || "").toUpperCase()));
            if (r.sub) div("sb", mr, r.sub);
            if (r.badge) div("bp-badge", mr, r.badge);
          });
        } else {
          var tile = div("ic", ne);
          var ic2 = iconNode(n.icon || "server", n.tone ? 22 : 30);
          if (ic2) tile.appendChild(ic2);
          if (n.tone) {
            tile.style.background = tone(n.tone, "#7643ff");
            tile.style.color = "#fff";
          }
          c.entity(n.id + ".label", div("lb", ne, label));
          if (n.sub) c.entity(n.id + ".sub", div("sb", ne, n.sub));
        }
        var xx = HF.bpGlyph ? null : null;
        void xx;
        var cross = svgEl("svg", { viewBox: "0 0 24 24", class: "xx", fill: "none", stroke: "currentColor", "stroke-width": "3", "stroke-linecap": "round" }, ne);
        svgEl("path", { d: "M5 5 19 19M19 5 5 19" }, cross);
        if (n.state) ne.setAttribute("data-state", n.state);
        c.entity(n.id, ne);
        nodeEls[n.id] = ne;
        // final (hook) state: everything except replaced components (final:false)
        visible[n.id] = FINAL ? n.final !== false : !n.hidden;
        if (!visible[n.id]) tl.set(ne, { autoAlpha: 0 }, 0);
      });

      // ---- edges ----
      var edges = [];
      (p.edges || []).forEach(function (e) {
        var pts = routeEdge(e, L);
        if (!pts) {
          c.problems.push("blueprint " + c.id + ": edge " + e.from + "->" + e.to + " names an unknown node");
          return;
        }
        var style = e.style || "solid";
        var col = style === "replica" ? "#e0a030" : style === "dashed" ? "#9b7bff" : "#9aa0a6";
        var path = svgEl("path", { d: ptsToD(pts), fill: "none", stroke: col, "stroke-width": 2.25, "stroke-linejoin": "round" }, svg);
        var len = ptsLen(pts);
        var dashed = style !== "solid";
        if (dashed) path.setAttribute("stroke-dasharray", "8 6");
        else {
          path.setAttribute("stroke-dasharray", len + " " + len);
          path.setAttribute("stroke-dashoffset", "0");
        }
        var rec = { e: e, pts: pts, path: path, len: len, dashed: dashed, shown: visible[e.from] && visible[e.to] && (FINAL || !e.hidden) };
        if (!rec.shown) tl.set(path, { autoAlpha: 0 }, 0);
        c.entity(e.from + "->" + e.to, path);
        edges.push(rec);
      });

      // ---- groups ----
      var groups = {};
      (p.groups || []).forEach(function (g) {
        var ids = (g.nodes || []).filter(function (id) {
          return L.box[id];
        });
        if (!ids.length) return;
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        ids.forEach(function (id) {
          var b = L.box[id];
          x0 = Math.min(x0, b.x);
          y0 = Math.min(y0, b.y);
          x1 = Math.max(x1, b.x + b.w);
          y1 = Math.max(y1, b.y + b.h);
        });
        var pad = 14;
        var ge = div("bp-group", gLayer);
        var gb = { x: x0 - pad, y: y0 - pad - 6, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad + 6 };
        Object.assign(ge.style, { left: gb.x + "px", top: gb.y + "px", width: gb.w + "px", height: gb.h + "px" });
        if (g.label) div("gl", ge, g.label);
        var shown = FINAL || g.hidden === false;
        if (!shown) tl.set(ge, { autoAlpha: 0 }, 0);
        groups[g.id] = { el: ge, box: { x: gb.x, y: gb.y - 14, w: Math.max(gb.w, (g.label ? measure(g.label, 600, 13, MONO) * 1.1 + 40 : 0)), h: gb.h + 14 }, shown: shown };
        c.entity(g.id, ge);
      });

      // ---- annotations ----
      var anns = [];
      function annBox(v) {
        var text = String(v.text || "").toUpperCase();
        var aw = measure(text, 700, 16, MONO) * 1.06 + 28 + (v.icon ? 26 : 0);
        var ah = 38;
        var tgt = L.box[v.at];
        var ax, ay;
        if (tgt) {
          var side = v.side || "below";
          if (side === "above") {
            ax = tgt.x + tgt.w / 2 - aw / 2;
            ay = tgt.y - ah - 12;
          } else if (side === "right") {
            ax = tgt.x + tgt.w + 14;
            ay = tgt.y + tgt.h / 2 - ah / 2;
          } else if (side === "left") {
            ax = tgt.x - 14 - aw;
            ay = tgt.y + tgt.h / 2 - ah / 2;
          } else {
            ax = tgt.x + tgt.w / 2 - aw / 2;
            ay = tgt.y + tgt.h + 12;
          }
        } else {
          ax = L.worldW / 2 - aw / 2;
          ay = L.worldH / 2 - ah / 2;
        }
        ax += Number(v.dx) || 0;
        ay += Number(v.dy) || 0;
        return { x: ax, y: ay, w: aw, h: ah, text: text };
      }

      // ---- camera: fit the visible content into the canvas body ----
      function bbox() {
        var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        var add = function (b) {
          x0 = Math.min(x0, b.x);
          y0 = Math.min(y0, b.y);
          x1 = Math.max(x1, b.x + b.w);
          y1 = Math.max(y1, b.y + b.h);
        };
        Object.keys(L.box).forEach(function (id) {
          if (visible[id]) add(L.box[id]);
        });
        edges.forEach(function (r) {
          if (r.shown) r.pts.forEach(function (q) { add({ x: q[0] - 2, y: q[1] - 2, w: 4, h: 4 }); });
        });
        Object.keys(groups).forEach(function (g) {
          if (groups[g].shown) add(groups[g].box);
        });
        anns.forEach(function (a) {
          if (a.shown) add(a.box);
        });
        if (!isFinite(x0)) return { x: L.worldW / 2 - 200, y: L.worldH / 2 - 150, w: 400, h: 300 };
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      var PAD = 26;
      function viewFor(b) {
        var iw = w - 2 * PAD;
        var ih = bodyH - 2 * PAD;
        var s = Math.min(iw / Math.max(1, b.w), ih / Math.max(1, b.h), MAX_SCALE);
        return { x: PAD + (iw - b.w * s) / 2 - b.x * s, y: PAD + (ih - b.h * s) / 2 - b.y * s, scale: s };
      }
      var view = viewFor(bbox());
      tl.set(world, { x: view.x, y: view.y, scale: view.scale, transformOrigin: "0 0" }, 0);
      var lastFit = null;
      function contains(v, b) {
        var ax = v.x + b.x * v.scale, ay = v.y + b.y * v.scale;
        return ax >= 4 && ay >= 4 && ax + b.w * v.scale <= w - 4 && ay + b.h * v.scale <= bodyH - 4;
      }
      function refit(t, dur, force) {
        var b = bbox();
        if (!force && p.fit === "manual") return;
        var nv = viewFor(b);
        if (!force && Math.abs(nv.scale - view.scale) < 0.01 && Math.abs(nv.x - view.x) < 3 && Math.abs(nv.y - view.y) < 3) return;
        // R6 §E26: the diagram rescales / recentres as it grows; collapse refits that land close together
        var at = t;
        if (lastFit && t - lastFit.t < 0.3) {
          lastFit.tw.kill();
          at = lastFit.t;
        }
        var tw = tl.to(world, { x: nv.x, y: nv.y, scale: nv.scale, duration: dur || 0.4, ease: "power2.inOut", immediateRender: false }, at);
        lastFit = { t: at, tw: tw };
        view = nv;
      }

      function showEdges(t) {
        var k = 0;
        edges.forEach(function (r) {
          if (r.shown || r.e.hidden || !visible[r.e.from] || !visible[r.e.to]) return;
          drawEdge(r, t + 0.05 + 0.05 * k++);
        });
      }
      function drawEdge(r, t) {
        r.shown = true;
        tl.set(r.path, { autoAlpha: 1 }, t);
        if (r.dashed) tl.fromTo(r.path, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none", immediateRender: false }, t);
        else tl.fromTo(r.path, { attr: { "stroke-dashoffset": r.len } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.3, ease: "sine.inOut", immediateRender: false }, t);
      }
      function node(id) {
        if (!nodeEls[id]) throw new Error("blueprint " + c.id + " has no node " + id);
        return nodeEls[id];
      }
      function list(v, one, many) {
        var out = [];
        if (v[one] !== undefined) out.push(v[one]);
        if (Array.isArray(v[many])) out = out.concat(v[many]);
        return out;
      }
      function setState(id, st, t) {
        tl.set(node(id), { attr: { "data-state": st } }, t);
      }
      function annotate(v, t) {
        var bx = annBox(v);
        var a = div("bp-ann", aLayer);
        var col = ANN[v.tone || "purple"] || ANN.purple;
        a.style.setProperty("--af", col[0]);
        a.style.setProperty("--al", col[1]);
        a.style.setProperty("--ac", col[2]);
        Object.assign(a.style, { left: bx.x + "px", top: bx.y + "px", width: bx.w + "px" });
        var ic = iconNode(v.icon, 18);
        if (ic) a.appendChild(ic);
        div("", a, bx.text);
        tl.set(a, { autoAlpha: 0 }, 0);
        tl.fromTo(a, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.133, ease: "power2.out", immediateRender: false }, t);
        var rec = { id: v.id || "a" + anns.length, el: a, box: bx, shown: true, at: v.at };
        anns.push(rec);
        c.entity("ann." + rec.id, a);
        if (!contains(view, bx)) refit(t, 0.4);
        return rec;
      }
      p.annotations && p.annotations.forEach(function (v) {
        var r = annotate(v, 0);
        void r;
      });
      if (p.annotations && p.annotations.length) {
        view = viewFor(bbox());
        tl.set(world, { x: view.x, y: view.y, scale: view.scale }, 0);
        lastFit = null;
      }

      return {
        ops: {
          // value {node | nodes | group | groups}: nodes pop in (0.9 -> 1 + fade, 4 f), their edges
          // draw on, groups outline; the diagram refits when it grows
          add: function (e) {
            var v = e.value || {};
            var ids = list(v, "node", "nodes");
            ids.forEach(function (id, i) {
              var ne = node(id);
              if (visible[id]) return;
              visible[id] = true;
              var t = e.t + i * 0.067;
              tl.fromTo(ne, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 4 * F, ease: "power2.out", immediateRender: false }, t);
            });
            list(v, "group", "groups").forEach(function (gid) {
              var g = groups[gid];
              if (!g) throw new Error("blueprint " + c.id + " has no group " + gid);
              if (g.shown) return;
              g.shown = true;
              tl.fromTo(g.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: "none", immediateRender: false }, e.t);
            });
            showEdges(e.t);
            refit(e.t, 0.4);
          },
          // value {node | nodes}: a component is replaced (V1 "one machine" -> servers); its edges go too
          remove: function (e) {
            var v = e.value || {};
            list(v, "node", "nodes").forEach(function (id) {
              var ne = node(id);
              if (!visible[id]) return;
              visible[id] = false;
              tl.to(ne, { autoAlpha: 0, scale: 0.94, duration: 3 * F, ease: "power2.in" }, e.t);
              edges.forEach(function (r) {
                if (r.shown && (r.e.from === id || r.e.to === id)) {
                  r.shown = false;
                  tl.to(r.path, { autoAlpha: 0, duration: 3 * F, ease: "none" }, e.t);
                }
              });
              anns.forEach(function (a) {
                if (a.shown && a.at === id) {
                  a.shown = false;
                  tl.set(a.el, { autoAlpha: 0 }, e.t);
                }
              });
            });
            refit(e.t, 0.4);
          },
          connect: function (e) {
            var r = edges.find(function (x) {
              return (x.e.from === e.value.from && x.e.to === e.value.to) || (x.e.from === e.value.to && x.e.to === e.value.from);
            });
            if (!r) throw new Error("blueprint " + c.id + " has no edge " + e.value.from + "->" + e.value.to);
            if (!r.shown) drawEdge(r, e.t);
          },
          // red tint + pink outer ring (R6 32.3); optional red pill under the node
          alert: function (e) {
            setState(e.value.node, "alert", e.t);
            if (e.value.text) annotate({ at: e.value.node, text: e.value.text, tone: "red", side: e.value.side, id: e.value.id }, e.t);
          },
          crash: function (e) {
            setState(e.value.node, "crash", e.t);
            if (e.value.text) annotate({ at: e.value.node, text: e.value.text, tone: "red", side: e.value.side, id: e.value.id }, e.t);
          },
          clear: function (e) {
            setState(e.value.node, "normal", e.t);
          },
          light: function (e) {
            setState(e.value.node, e.value.state || "lit", e.t);
          },
          annotate: function (e) {
            annotate(e.value || {}, e.t);
          },
          unannotate: function (e) {
            var id = e.value && e.value.id;
            var shown = anns.filter(function (a) {
              return a.shown && (!id || a.id === id);
            });
            (id ? shown : shown.slice(-1)).forEach(function (a) {
              a.shown = false;
              tl.set(a.el, { autoAlpha: 0 }, e.t);
            });
          },
          // dots travelling an edge (continuous while the host idles in R6; here finite loops)
          packet: function (e) {
            var v = e.value || {};
            var r = edges.find(function (x) {
              return (x.e.from === v.from && x.e.to === v.to) || (x.e.from === v.to && x.e.to === v.from);
            });
            if (!r) throw new Error("blueprint " + c.id + " has no edge " + v.from + "->" + v.to);
            var rev = r.e.from !== v.from;
            var loops = Math.max(1, Math.min(8, v.loops || 3));
            var dur = Math.max(0.35, r.len / (v.speed || 320));
            var n = Math.max(1, Math.min(3, v.count || 2));
            for (var k = 0; k < n; k++) {
              var dot = div("bp-pkt", pktLayer);
              dot.style.background = tone(v.tone || "purple", "#7643ff");
              tl.set(dot, { autoAlpha: 0 }, 0);
              var o = { k: 0 };
              var place = (function (dotEl, prox) {
                return function () {
                  var d = (prox.k % 1) * r.len;
                  var q = ptAt(r.pts, rev ? r.len - d : d);
                  dotEl.style.left = q[0] + "px";
                  dotEl.style.top = q[1] + "px";
                };
              })(dot, o);
              var t0 = e.t + (k * dur) / n;
              var q0 = ptAt(r.pts, rev ? r.len : 0);
              tl.set(dot, { autoAlpha: 1, left: q0[0] + "px", top: q0[1] + "px" }, t0);
              tl.to(o, { k: loops - 0.001, duration: dur * loops, ease: "none", immediateRender: false, onUpdate: place }, t0);
              tl.set(dot, { autoAlpha: 0 }, t0 + dur * loops);
            }
          },
          version: function (e) {
            var n = e.value && e.value.n !== undefined ? e.value.n : e.value;
            tl.set(ver, { textContent: "V" + n, visibility: "visible" }, e.t);
            pop(tl, ver, e.t, 1.25);
          },
          refit: function (e) {
            refit(e.t, (e.value && e.value.dur) || 0.4, true);
          },
        },
      };
    },
  };

  // ================================================================== ghost -> lit family (§5.14)
  function ghostCard(parent, cls, lit) {
    var g = div(cls + " bp-ghost", parent);
    if (lit) g.setAttribute("data-lit", "1");
    return g;
  }
  function giTile(parent, cls, icon, t, size) {
    var gi = div(cls + " gi", parent);
    var tt = tintOf(t || "purple");
    gi.style.setProperty("--gi-bg", t ? tt[0] : "#efeafb");
    gi.style.setProperty("--gi-fg", tone(t || "purple", "#7643ff"));
    var ic = iconNode(icon || "zap", size);
    if (ic) gi.appendChild(ic);
    return gi;
  }
  function litOps(c, cards) {
    function pick(v) {
      var i = v && (v.i !== undefined ? v.i : v.item !== undefined ? v.item : v.card !== undefined ? v.card : v.row);
      if (!cards[i - 1]) throw new Error(c.id + ": no item " + i);
      return cards[i - 1];
    }
    return {
      // ghost (dashed, grey) -> lit (solid, ink, shadow) in 1 f + a 4-f 1.02 pulse (R6 §5.14)
      lit: function (e) {
        var k = pick(e.value);
        c.tl.set(k, { attr: { "data-lit": "1" } }, e.t);
        pop(c.tl, k, e.t, 1.02);
      },
      unlit: function (e) {
        c.tl.set(pick(e.value), { attr: { "data-lit": "0" } }, e.t);
      },
      // E9: each card rotates +-10-20 deg and falls down-left, 7 f ease-in, 33 ms stagger
      tumble: function (e) {
        cards.forEach(function (k, j) {
          var t = e.t + j * 0.033;
          c.tl.to(k, { rotation: j % 2 ? 16 : -14, x: -160 - 40 * j, y: 700, duration: 0.233, ease: "power2.in" }, t);
          c.tl.set(k, { autoAlpha: 0 }, t + 0.233);
        });
      },
    };
  }

  // featureRows: props {items: [{icon, tone?, title, sub?, visual?: [chip]}], lit?: number lit at start}
  M.featureRows = {
    enter: "fade",
    build: function (el, p, c) {
      var items = p.items || [];
      var gap = 21;
      var rh = Math.max(96, (H(el) - gap * (items.length - 1)) / Math.max(1, items.length));
      var w = W(el);
      var rows = items.map(function (it, i) {
        var r = ghostCard(el, "bp-fr", i < (p.lit || 0));
        r.style.top = i * (rh + gap) + "px";
        r.style.height = rh + "px";
        giTile(r, "", it.icon, it.tone, 34);
        var vw = it.visual ? chipsWidth(it.visual) : 0;
        var tt = String(it.title || "").toUpperCase();
        var fs = fitSize(tt, 800, rh >= 150 ? 34 : 28, w - 120 - vw - 34, 18);
        var t = div("t gt", r, tt);
        t.style.fontSize = fs + "px";
        var hasSub = !!it.sub;
        t.style.top = rh / 2 - (hasSub ? fs * 1.05 + 2 : fs * 0.55) + "px";
        if (hasSub) {
          var s = div("s", r, it.sub);
          s.style.top = rh / 2 + 6 + "px";
          s.style.maxWidth = w - 150 - vw + "px";
          s.style.overflow = "hidden";
        }
        if (it.visual) chipRow(r, it.visual, 0, rh / 2 - 17, true, 20);
        c.entity("r" + (i + 1), r);
        return r;
      });
      return { ops: litOps(c, rows) };
    },
  };

  // costCards: props {items: [{icon, tone?, name, consequence, visual?: [chip]}], lit?}
  M.costCards = {
    enter: "fade",
    build: function (el, p, c) {
      var items = p.items || [];
      var gap = 21;
      var ch = Math.max(150, (H(el) - gap * (items.length - 1)) / Math.max(1, items.length));
      var w = W(el);
      var cards = items.map(function (it, i) {
        var k = ghostCard(el, "bp-cc", i < (p.lit || 0));
        k.style.top = i * (ch + gap) + "px";
        k.style.height = ch + "px";
        var hd = div("hd gt", k);
        giTile(hd, "", it.icon, it.tone || "purple", 24);
        div("", hd, String(it.name || "").toUpperCase());
        var q = String(it.consequence || "").toUpperCase();
        var vw = it.visual ? chipsWidth(it.visual) : 0;
        var fs = fitSize(q, 800, ch >= 250 ? 40 : 32, w - 48 - (vw ? vw + 24 : 0), 20);
        var cq = div("cq gr", k, q);
        cq.style.fontSize = fs + "px";
        cq.style.top = Math.min(ch - fs - 26, 88) + "px";
        cq.style.whiteSpace = "nowrap";
        if (it.visual) chipRow(k, it.visual, 0, Math.min(ch - 60, 88 + fs / 2 - 17), true, 20);
        c.entity("c" + (i + 1), k);
        return k;
      });
      return { ops: litOps(c, cards) };
    },
  };

  // techCards: props {items: [{icon, tone?, title, sub?}] (2-4), lit?}
  M.techCards = {
    enter: "fade",
    build: function (el, p, c) {
      var items = (p.items || []).slice(0, 4);
      var gap = 21;
      var cols = items.length <= 2 ? items.length : 2;
      var rowsN = Math.ceil(items.length / Math.max(1, cols));
      var cw = (W(el) - gap * (cols - 1)) / Math.max(1, cols);
      var chh = (H(el) - gap * (rowsN - 1)) / Math.max(1, rowsN);
      var cards = items.map(function (it, i) {
        var k = ghostCard(el, "bp-tc", i < (p.lit || 0));
        Object.assign(k.style, { left: (i % cols) * (cw + gap) + "px", top: Math.floor(i / cols) * (chh + gap) + "px", width: cw + "px", height: chh + "px" });
        giTile(k, "", it.icon, it.tone, 52);
        var tt = String(it.title || "").toUpperCase();
        var t = div("t gt", k, tt);
        t.style.fontSize = fitSize(tt, 800, 32, cw - 36, 18) + "px";
        if (it.sub) div("s", k, it.sub).style.fontSize = fitSize(it.sub, 500, 17, cw - 36, 12, MONO) + "px";
        c.entity("c" + (i + 1), k);
        return k;
      });
      return { ops: litOps(c, cards) };
    },
  };

  // ================================================================== displayHeadline (§5.15)
  // props {lines: [string | {text, tone?}], accent?: [words], accentTone?: "red", dim?: true, size?, pitch?}
  // ops   lit {line?, word?} (dim -> ink, accent words -> accent tone), tone {line, word?, tone}
  M.displayHeadline = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-displayHeadline");
      var lines = p.lines || [];
      var size = p.size || 111; // cap 81 (R6 101.5)
      var pitch = p.pitch || Math.round(size * 1.0);
      var maxW = W(el) - 8;
      lines.forEach(function (ln) {
        var txt = String(typeof ln === "string" ? ln : ln.text || "").toUpperCase();
        var wpx = measure(txt, 800, size) - 0.02 * size * txt.length;
        if (wpx > maxW) size = Math.floor((size * maxW) / wpx);
      });
      pitch = Math.min(pitch, Math.round(size * 1.0) + 4);
      var acc = (p.accent || []).map(function (a) {
        return String(a).toUpperCase().replace(/[^A-Z0-9]/g, "");
      });
      var accCol = tone(p.accentTone || "red", "#ae2435");
      var INK = "#141920";
      var DIM = "#5a6269";
      var dim = p.dim !== false;
      var spans = [];
      var lineEls = lines.map(function (ln, i) {
        var txt = String(typeof ln === "string" ? ln : ln.text || "").toUpperCase();
        var d = div("dl", el);
        d.style.fontSize = size + "px";
        d.style.height = pitch + "px";
        d.style.lineHeight = pitch + "px";
        var lineTone = typeof ln === "object" && ln.tone ? tone(ln.tone, INK) : null;
        spans[i] = txt.split(/\s+/).map(function (wd, wi, arr) {
          var sp = document.createElement("span");
          sp.textContent = wd;
          var isAcc = acc.indexOf(wd.replace(/[^A-Z0-9]/g, "")) >= 0;
          sp._lit = isAcc ? accCol : lineTone || INK;
          sp.style.color = dim ? DIM : sp._lit;
          d.appendChild(sp);
          if (wi < arr.length - 1) d.appendChild(document.createTextNode(" "));
          return sp;
        });
        c.entity("l" + (i + 1), d);
        return d;
      });
      function pick(v) {
        var out = [];
        spans.forEach(function (ws, li) {
          if (v && v.line && v.line !== li + 1) return;
          ws.forEach(function (sp) {
            if (v && v.word !== undefined) {
              var k = String(v.word).toUpperCase().replace(/[^A-Z0-9]/g, "");
              if (sp.textContent.replace(/[^A-Z0-9]/g, "") !== k) return;
            }
            out.push(sp);
          });
        });
        return out;
      }
      return {
        enter: function (t) {
          // R6 E14: cuts in (1 f) at the dim grey
          lineEls.forEach(function (d) {
            c.tl.fromTo(d, { autoAlpha: 0 }, { autoAlpha: 1, duration: F, ease: "none", immediateRender: false }, t);
          });
        },
        ops: {
          // R6 E14: #5A6269 -> #141920 (accent words -> red) in 1-2 f
          lit: function (e) {
            var ws = pick(e.value || {});
            if (!ws.length) throw new Error("displayHeadline lit: no such line/word");
            ws.forEach(function (sp) {
              c.tl.to(sp, { color: sp._lit, duration: 2 * F, ease: "none" }, e.t);
            });
          },
          tone: function (e) {
            var ws = pick(e.value || {});
            var col = tone(e.value && e.value.tone, accCol);
            ws.forEach(function (sp) {
              c.tl.to(sp, { color: col, duration: 2 * F, ease: "none" }, e.t);
            });
          },
        },
      };
    },
  };

  // ================================================================== strikeStrips (§5.16)
  // props {no: {eyebrow, text}, yes: {eyebrow, text}}; ops strike, lit {strip?: 2}
  M.strikeStrips = {
    enter: "fade",
    build: function (el, p, c) {
      var w = W(el);
      var gap = 21;
      var sh = Math.min(170, (H(el) - gap) / 2);
      var mk = function (cls, spec, i) {
        var s = div("bp-ss " + cls, el);
        s.style.top = i * (sh + gap) + "px";
        s.style.height = sh + "px";
        if (cls === "yes") {
          s.classList.add("bp-ghost");
        }
        div("e", s, (cls === "no" ? "✕ " : "✓ ") + String(spec.eyebrow || "").toUpperCase());
        var tt = String(spec.text || "").toUpperCase();
        var x = div("x gt", s, tt);
        var fs = fitSize(tt, 800, 48, w - 56, 22);
        x.style.fontSize = fs + "px";
        x.style.top = 24 + 22 + (sh - 46 - fs) / 2 + "px";
        c.entity(cls, s);
        return { s: s, x: x, fs: fs, tt: tt };
      };
      var no = mk("no", p.no || {}, 0);
      var yes = mk("yes", p.yes || {}, 1);
      var tw = Math.min(w - 56, measure(no.tt, 800, no.fs) - 0.01 * no.fs * no.tt.length);
      var ln = div("ln", no.s);
      Object.assign(ln.style, { left: "24px", width: tw + 8 + "px", top: parseFloat(no.x.style.top) + no.fs * 0.58 + "px" });
      c.tl.set(ln, { scaleX: 0 }, 0);
      return {
        ops: {
          // E13: 6-7.5 px #E8474E, 333 ms power2.inOut
          strike: function (e) {
            c.tl.to(ln, { scaleX: 1, duration: 0.333, ease: "power2.inOut" }, e.t);
            c.tl.to(no.x, { color: "#6b7075", duration: 0.133, ease: "none" }, e.t + 0.333);
          },
          lit: function (e) {
            c.tl.set(yes.s, { attr: { "data-lit": "1" } }, e.t);
            pop(c.tl, yes.s, e.t, 1.02);
          },
        },
      };
    },
  };

  // ================================================================== verdictStamp (§5.18 stamp v2)
  // props {lines: [string] (1-2), tone?: red|green|amber, sub?: string, icons?: [icon names]}
  M.verdictStamp = {
    enter: "none",
    build: function (el, p, c) {
      el.classList.add("st-verdictStamp");
      if (p.tone) el.setAttribute("data-tone", p.tone);
      var lines = (p.lines || [p.text || "NOT THIS"]).map(function (s) {
        return String(s).toUpperCase();
      });
      var sp = div("sp", el);
      var longest = lines.reduce(function (a, s) {
        return measure(s, 900, 64) > measure(a, 900, 64) ? s : a;
      }, "");
      var fs = fitSize(longest, 900, 64, W(el) * 0.8 - 80, 30);
      sp.style.fontSize = fs + "px";
      lines.forEach(function (s) {
        div("", sp, s);
      });
      c.entity("stamp", sp);
      var sub = null;
      if (p.sub || (p.icons && p.icons.length)) {
        sub = div("sub", el);
        sub.style.display = "flex";
        sub.style.alignItems = "center";
        sub.style.gap = "16px";
        (p.icons || []).forEach(function (n) {
          var ic = iconNode(n, 34);
          if (ic) sub.appendChild(ic);
        });
        if (p.sub) div("", sub, p.sub);
        c.entity("sub", sub);
      }
      return {
        enter: function (t) {
          // E10: full opacity on frame 1, scale 1.30 -> 1.0 over 5 f, power2.out
          c.tl.fromTo(sp, { autoAlpha: 1, scale: 1.3, rotation: -5 }, { autoAlpha: 1, scale: 1, rotation: -5, duration: 0.167, ease: "power2.out", immediateRender: false }, t);
          if (sub) c.tl.fromTo(sub, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out", immediateRender: false }, t + 0.3);
        },
      };
    },
  };

  // ================================================================== phone (§5.7)
  // props {screen: blank|feed|post, app?, user?, caption?, image?, file?: {name, size}, duration?, timer?: 0}
  // ops   screen {name}, timer {to, from?, dur?}, progress {to (0-100), dur?}
  M.phone = {
    enter: "fade",
    build: function (el, p, c) {
      var pw = Math.min(W(el), 330);
      var ph = Math.min(H(el), 675);
      var ox = (W(el) - pw) / 2;
      var fr = div("bp-ph", el);
      Object.assign(fr.style, { left: ox + "px", width: pw + "px", height: ph + "px" });
      var scr = div("scr", fr);
      div("notch", fr);
      div("clock", fr, "9:41");
      var sw = pw - 24;
      var screens = {};
      function appBar(sv, left, right) {
        var ab = div("ab", sv);
        div("", ab, left);
        if (right) div("r", ab, right);
      }
      function media(sv, top, hgt, play) {
        var md = div("med", sv);
        md.style.top = top + "px";
        md.style.height = hgt + "px";
        if (p.image) {
          var im = document.createElement("img");
          im.src = p.image;
          im.alt = "";
          md.appendChild(im);
        }
        if (play) {
          var pl = div("play", md);
          var tri = svgEl("svg", { viewBox: "0 0 24 24", width: 26, height: 26 }, pl);
          svgEl("path", { d: "M8 5v14l11-7z", fill: "#fff" }, tri);
          div("dur", md, p.duration || "0:42");
        }
        return md;
      }
      // blank
      var sb = div("sv", scr);
      appBar(sb, p.app || "circle");
      [0, 1, 2, 3, 4].forEach(function (k) {
        var s = div("skel", sb);
        s.style.top = 120 + k * 34 + "px";
        s.style.width = [200, 150, 230, 120, 180][k] + "px";
      });
      screens.blank = sb;
      // feed
      var sf = div("sv", scr);
      appBar(sf, p.app || "circle", "♡  ✈");
      var who = div("who", sf);
      who.style.top = "108px";
      document.createElement("i");
      who.appendChild(document.createElement("i"));
      div("", who, p.user || "maya.k");
      var mh = Math.round(sw * 0.82);
      media(sf, 154, mh, false);
      var acts = div("acts", sf);
      acts.style.top = 154 + mh + 14 + "px";
      ["♡", "✉", "↗"].forEach(function (g) {
        div("", acts, g).style.fontSize = "22px";
      });
      var cap = div("cap", sf, p.caption || "Sunday morning, first light");
      cap.style.top = 154 + mh + 52 + "px";
      var who2 = div("who", sf);
      who2.style.top = 154 + mh + 96 + "px";
      who2.style.opacity = ".45";
      who2.appendChild(document.createElement("i"));
      div("", who2, "ana.r");
      screens.feed = sf;
      // post (upload in progress)
      var sp = div("sv", scr);
      appBar(sp, "New post", "Share");
      var mh2 = Math.round(sw * 0.62);
      media(sp, 104, mh2, true);
      var cap2 = div("cap", sp, p.caption || "Caught the best wave of my life");
      cap2.style.top = 104 + mh2 + 14 + "px";
      var file = div("file", sp);
      file.style.top = 104 + mh2 + 60 + "px";
      var fi = iconNode("file", 16);
      if (fi) file.appendChild(fi);
      div("", file, (p.file && p.file.name) || "trip.mp4");
      div("z", file, (p.file && p.file.size) || "480 MB");
      var prog = div("prog", sp);
      prog.style.top = 104 + mh2 + 118 + "px";
      var pf = document.createElement("i");
      prog.appendChild(pf);
      pf.style.transform = "scaleX(" + (p.progress !== undefined ? p.progress / 100 : 1) + ")";
      var proc = div("proc", sp);
      proc.style.top = 104 + mh2 + 140 + "px";
      var spin = div("spin", proc);
      div("", proc, "Processing…");
      var tim = c.entity("timer", document.createElement("b"));
      tim.textContent = (Number(p.timer) || 0).toFixed(1) + " s";
      proc.appendChild(tim);
      screens.post = sp;
      var cur = p.screen && screens[p.screen] ? p.screen : "feed";
      Object.keys(screens).forEach(function (k) {
        if (k !== cur) c.tl.set(screens[k], { autoAlpha: 0 }, 0);
      });
      var timerVal = Number(p.timer) || 0;
      return {
        ops: {
          screen: function (e) {
            var n = e.value && (e.value.name || e.value.screen);
            if (!screens[n]) throw new Error("phone: no screen " + n);
            Object.keys(screens).forEach(function (k) {
              c.tl.set(screens[k], { autoAlpha: k === n ? 1 : 0 }, e.t);
            });
          },
          // real-time processing timer ("Processing... 8.9 s") + spinner (finite turns)
          timer: function (e) {
            var v = e.value || {};
            var from = v.from !== undefined ? Number(v.from) : timerVal;
            var to = Number(v.to);
            var dur = v.dur || Math.max(0.3, to - from);
            var o = { v: from };
            c.tl.to(o, { v: to, duration: dur, ease: "none", immediateRender: false, onUpdate: function () { tim.textContent = o.v.toFixed(1) + " s"; } }, e.t);
            c.tl.to(spin, { rotation: 360 * Math.max(1, Math.round(dur / 0.8)), duration: dur, ease: "none" }, e.t);
            timerVal = to;
          },
          progress: function (e) {
            c.tl.to(pf, { scaleX: Math.max(0, Math.min(100, e.value.to)) / 100, duration: e.value.dur || 0.8, ease: "power1.inOut" }, e.t);
          },
        },
      };
    },
  };

  // ================================================================== reqList / jobList (§5.8)
  // props {eyebrow, icon?, rows: [{verb?, path?} | {label, icon?, value?}], total?: {label, value}}
  // ops   rowLit {row, tone?: blue|red|green}, total {tone?: red, text?}
  M.reqList = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-bpc");
      var rows = p.rows || [];
      var eyeH = p.eyebrow ? 58 : 16;
      var totH = p.total ? 84 : 0;
      var gap = 14;
      var avail = H(el) - eyeH - totH - 18 - (p.total ? 18 : 0);
      var rh = Math.max(50, Math.min(80, (avail - gap * (rows.length - 1)) / Math.max(1, rows.length)));
      if (p.eyebrow) {
        var eb = div("bp-eyebrow", el);
        Object.assign(eb.style, { position: "absolute", left: "20px", top: "20px" });
        var ei = iconNode(p.icon, 18);
        if (ei) eb.appendChild(ei);
        div("", eb, p.eyebrow);
      }
      var w = W(el);
      var rowEls = rows.map(function (r, i) {
        var row = div("bp-rl-row", el);
        row.style.top = eyeH + i * (rh + gap) + "px";
        row.style.height = rh + "px";
        if (r.verb || r.path) {
          div("vb", row, String(r.verb || "GET").toUpperCase());
          var pa = div("pa", row, r.path || "/");
          pa.style.fontSize = fitSize(r.path || "/", 500, 17, w - 36 - 28 - 70, 11, MONO) + "px";
        } else {
          if (r.icon) {
            var ri = div("ri", row);
            var ic = iconNode(r.icon, 22);
            if (ic) ri.appendChild(ic);
          }
          var lb = div("lb", row, String(r.label || "").toUpperCase());
          lb.style.fontSize = fitSize(String(r.label || "").toUpperCase(), 700, 19, w - 36 - 28 - (r.icon ? 34 : 0) - (r.value ? measure(r.value, 700, 18, MONO) + 16 : 0), 12) + "px";
        }
        if (r.value !== undefined) div("va", row, r.value);
        if (r.tone) row.setAttribute("data-tone", r.tone);
        c.entity("row" + (i + 1), row);
        return row;
      });
      var tot = null;
      if (p.total) {
        tot = div("bp-rl-tot", el);
        tot.style.top = H(el) - totH - 18 + "px";
        tot.style.height = totH + "px";
        div("lb", tot, p.total.label || "TOTAL");
        c.entity("total", div("va", tot, p.total.value || ""));
      }
      return {
        ops: {
          // R6 §5.8: per-row 1-2 f recolour on its word
          rowLit: function (e) {
            var r = rowEls[(e.value && e.value.row) - 1];
            if (!r) throw new Error("reqList: no row " + (e.value && e.value.row));
            c.tl.set(r, { attr: { "data-tone": e.value.tone || "blue" } }, e.t);
          },
          total: function (e) {
            if (!tot) throw new Error("reqList: no total row");
            c.tl.set(tot, { attr: { "data-tone": (e.value && e.value.tone) || "red" } }, e.t);
            if (e.value && e.value.text) c.tl.set(tot.lastChild, { textContent: e.value.text }, e.t);
            pop(c.tl, tot, e.t, 1.04);
          },
        },
      };
    },
  };

  // ================================================================== dotGrid (§5.9)
  // props {rows: 5, cols: 20, eyebrow?, filled?: count, tone?: blue}
  // ops   fill {to?, dur?: 1.0} (row-major raster, linear), mark {i, tone}, sweep {tone, dur?, skip?}
  M.dotGrid = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-bpc");
      var rows = p.rows || 5;
      var cols = p.cols || 20;
      var top = p.eyebrow ? 60 : 22;
      if (p.eyebrow) {
        var eb = div("bp-eyebrow", el, p.eyebrow);
        Object.assign(eb.style, { position: "absolute", left: "22px", top: "22px" });
      }
      var aw = W(el) - 44;
      var ah = H(el) - top - 22;
      var pitch = Math.min(aw / cols, ah / rows);
      var d = pitch * 0.66;
      var ox = 22 + (aw - pitch * cols) / 2 + (pitch - d) / 2;
      var oy = top + (ah - pitch * rows) / 2 + (pitch - d) / 2;
      var fillCol = tone(p.tone || "blue", "#1f4dbd");
      var dots = [];
      for (var r = 0; r < rows; r++)
        for (var k = 0; k < cols; k++) {
          var dt = div("bp-dot", el);
          Object.assign(dt.style, { left: ox + k * pitch + "px", top: oy + r * pitch + "px", width: d + "px", height: d + "px", borderRadius: d * 0.22 + "px" });
          if (p.filled && dots.length < p.filled) dt.style.background = fillCol;
          dots.push(dt);
        }
      var filled = p.filled || 0;
      return {
        ops: {
          fill: function (e) {
            var v = e.value || {};
            var to = Math.min(dots.length, v.to || dots.length);
            var dur = v.dur || 1.0;
            var col = tone(v.tone, fillCol);
            for (var i = filled; i < to; i++) c.tl.set(dots[i], { background: col }, e.t + ((i - filled) / Math.max(1, to - filled)) * dur);
            filled = to;
          },
          mark: function (e) {
            var i = (e.value && e.value.i) || 1;
            c.tl.set(dots[i - 1], { background: tone(e.value.tone || "amber", "#e0a030") }, e.t);
            pop(c.tl, dots[i - 1], e.t, 1.5);
          },
          sweep: function (e) {
            var v = e.value || {};
            var col = tone(v.tone || "purple", "#7643ff");
            var skip = (v.skip || []).map(Number);
            var dur = v.dur || 0.8;
            dots.forEach(function (dt, i) {
              if (skip.indexOf(i + 1) >= 0) return;
              c.tl.set(dt, { background: col }, e.t + (i / dots.length) * dur);
            });
          },
        },
      };
    },
  };

  // ================================================================== hitCounter (§5.9)
  // props {avatar?: src, handle, route, count?: 0, label?: "REQUESTS"}; ops count {to, dur?}
  M.hitCounter = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-bpc");
      var h = H(el);
      var avd = Math.min(120, h - 50);
      var av = div("", el);
      Object.assign(av.style, { position: "absolute", left: "26px", top: (h - avd) / 2 + "px", width: avd + "px", height: avd + "px", borderRadius: "50%", overflow: "hidden", background: "#7643ff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: avd * 0.36 + "px", boxShadow: "0 0 0 3px #fff, 0 2px 8px rgba(0,0,0,.15)" });
      if (p.avatar) {
        var im = document.createElement("img");
        im.src = p.avatar;
        im.alt = "";
        Object.assign(im.style, { width: "100%", height: "100%", objectFit: "cover" });
        av.appendChild(im);
      } else av.textContent = initials(p.handle);
      var x0 = 26 + avd + 24;
      var hd = div("", el, p.handle || "");
      Object.assign(hd.style, { position: "absolute", left: x0 + "px", top: h / 2 - 44 + "px", fontWeight: "800", fontSize: "36px", color: "#141920", whiteSpace: "nowrap" });
      var rp = div("bp-chip", el, p.route || "GET /");
      Object.assign(rp.style, { position: "absolute", left: x0 + "px", top: h / 2 + 8 + "px" });
      rp.style.setProperty("--cf", "#e3ebf9");
      rp.style.setProperty("--cl", "#b3c6ee");
      rp.style.setProperty("--ca", "#1f4dbd");
      var n = c.entity("count", div("bp-big", el, String(p.count || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")));
      Object.assign(n.style, { position: "absolute", right: "26px", top: h / 2 - 44 + "px", fontSize: "58px", color: "#1f4dbd" });
      var lb = div("", el, p.label || "REQUESTS");
      Object.assign(lb.style, { position: "absolute", right: "26px", top: h / 2 + 24 + "px", fontFamily: MONO, fontSize: "16px", fontWeight: "600", letterSpacing: ".1em", color: "#6b7075" });
      var cur = Number(p.count) || 0;
      return {
        ops: {
          count: function (e) {
            var to = Number(e.value.to);
            var o = { v: cur };
            var fmt = function (x) {
              return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            };
            c.tl.set(n, { textContent: fmt(cur) }, e.t);
            c.tl.to(o, { v: to, duration: e.value.dur || 1.0, ease: e.value.ease || "power2.out", immediateRender: false, onUpdate: function () { n.textContent = fmt(o.v); } }, e.t);
            cur = to;
          },
        },
      };
    },
  };

  // ================================================================== vsCards (§5.9)
  // props {cards: [{icon, tone?, title, sub?, value, label?, foot?}] (2), lit?: 1|2}; ops lit {card}
  M.vsCards = {
    enter: "fade",
    build: function (el, p, c) {
      var gap = 21;
      var cw = (W(el) - gap) / 2;
      var h = H(el);
      var cards = (p.cards || []).slice(0, 2).map(function (it, i) {
        var k = ghostCard(el, "bp-vs", p.lit === i + 1);
        k.style.left = i * (cw + gap) + "px";
        k.style.width = cw + "px";
        var hd = div("hd gt", k);
        giTile(hd, "", it.icon, it.tone, 22).style.cssText += "width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none;";
        var tt = String(it.title || "").toUpperCase();
        var tn = div("", hd, tt);
        tn.style.fontSize = fitSize(tt, 800, 26, cw - 48 - 56, 16) + "px";
        if (it.sub) div("su", k, it.sub);
        var vs = String(it.value || "");
        var v = div("v bp-big", k, vs);
        var fs = fitSize(vs, 800, 72, cw - 48, 28, MONO);
        v.style.fontSize = fs + "px";
        v.style.top = Math.max(118, h * 0.36) + "px";
        if (it.label) {
          var lb = div("lab", k, it.label);
          lb.style.top = Math.max(118, h * 0.36) + fs + 14 + "px";
        }
        if (it.foot) div("ft", k, it.foot);
        c.entity("c" + (i + 1), k);
        return k;
      });
      return { ops: litOps(c, cards) };
    },
  };

  // ================================================================== latencyBars (§5.13)
  // props {eyebrow?, bars: [{label, value (0-100), display, tone?}], footer?, filled?: false}
  // ops   fill {bar?, dur?}
  M.latencyBars = {
    enter: "fade",
    build: function (el, p, c) {
      el.classList.add("st-bpc", "bp-lb");
      var w = W(el);
      var top = p.eyebrow ? 70 : 26;
      if (p.eyebrow) {
        var eb = div("bp-eyebrow", el, p.eyebrow);
        Object.assign(eb.style, { position: "absolute", left: "24px", top: "24px" });
      }
      var bars = p.bars || [];
      var foot = p.footer ? 58 : 0;
      var pitch = Math.min(130, (H(el) - top - foot - 20) / Math.max(1, bars.length));
      var items = bars.map(function (b, i) {
        var y = top + i * pitch;
        var l = div("l", el, String(b.label || "").toUpperCase());
        l.style.top = y + "px";
        l.style.fontSize = fitSize(String(b.label || "").toUpperCase(), 800, 22, w - 48, 14) + "px";
        var vw = measure(b.display || "", 800, 28, MONO) + 20;
        var tk = div("tk", el);
        Object.assign(tk.style, { top: y + 40 + "px", width: w - 48 - vw - 10 + "px" });
        var fl = div("fl", tk);
        var col = tone(b.tone || "purple", "#7643ff");
        fl.style.width = "100%";
        fl.style.background = col;
        fl.style.transform = "scaleX(" + (p.filled ? (b.value || 0) / 100 : 0) + ")";
        var v = div("v", el, b.display || "");
        v.style.top = y + 38 + "px";
        v.style.color = col;
        c.entity("b" + (i + 1), tk);
        return { fl: fl, b: b };
      });
      if (p.footer) div("ft", el, p.footer);
      return {
        ops: {
          fill: function (e) {
            var v = e.value || {};
            var list = v.bar ? [items[v.bar - 1]] : items;
            list.forEach(function (x, j) {
              if (!x) throw new Error("latencyBars: no bar " + v.bar);
              c.tl.to(x.fl, { scaleX: (x.b.value || 0) / 100, duration: v.dur || 0.6, ease: "power2.out" }, e.t + j * 0.2);
            });
          },
        },
      };
    },
  };

  // ================================================================== logoGrid (§5.18)
  // props {label?, tiles: [{icon | logo | text}], cols?: 6, start?: shown at start (default all), counter?: true}
  // ops   flood {to?, dur?} accelerating pop-in (stagger shrinking to ~1 f) + counter
  M.logoGrid = {
    enter: "fade",
    build: function (el, p, c) {
      var tiles = p.tiles || [];
      var cols = p.cols || 6;
      var w = W(el);
      var top = p.label || p.counter !== false ? 58 : 0;
      var pitch = Math.min(120, (w + 15) / cols);
      var ts = pitch - 15;
      var ox = (w - (cols * pitch - 15)) / 2;
      var start = p.start !== undefined ? p.start : tiles.length;
      if (p.label) {
        var eb = div("bp-eyebrow", el, p.label);
        Object.assign(eb.style, { position: "absolute", left: "0px", top: "8px" });
      }
      var cnt = null;
      if (p.counter !== false) {
        cnt = c.entity("counter", div("bp-big", el, String(start)));
        Object.assign(cnt.style, { position: "absolute", right: "0px", top: "0px", fontSize: "40px", color: "#ae2435" });
      }
      var els = tiles.map(function (t, i) {
        var o = typeof t === "string" ? { icon: t } : t || {};
        var te = div("bp-tile", el);
        Object.assign(te.style, { left: ox + (i % cols) * pitch + "px", top: top + Math.floor(i / cols) * pitch + "px", width: ts + "px", height: ts + "px" });
        var ic = iconNode(o.logo || o.icon, Math.round(ts * 0.44));
        if (ic) te.appendChild(ic);
        else te.textContent = String(o.text || "").toUpperCase().slice(0, 4);
        if (o.tone) te.style.color = tone(o.tone, "#141920");
        if (i >= start) c.tl.set(te, { autoAlpha: 0 }, 0);
        return te;
      });
      var shown = start;
      return {
        ops: {
          flood: function (e) {
            var v = e.value || {};
            var to = Math.min(els.length, v.to || els.length);
            var dur = v.dur || 2.4;
            var n = to - shown;
            for (var i = 0; i < n; i++) {
              var t = e.t + dur * Math.sqrt((i + 1) / n) - dur * Math.sqrt(1 / n);
              var te = els[shown + i];
              c.tl.fromTo(te, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 4 * F, ease: "back.out(2)", immediateRender: false }, t);
              if (cnt) c.tl.set(cnt, { textContent: String(shown + i + 1) }, t);
            }
            shown = to;
          },
        },
      };
    },
  };

  // ================================================================== imageSlot (§5.19)
  // props {src?, shape?: circle|rounded, ring?: true, play?: true, label?, initials?, tone?}
  M.imageSlot = {
    enter: "fade",
    build: function (el, p, c) {
      el.setAttribute("data-shape", p.shape || "rounded");
      if (p.ring !== false) el.setAttribute("data-ring", "1");
      var im = div("im", el);
      if (p.src) {
        var img = document.createElement("img");
        img.src = p.src;
        img.alt = "";
        im.appendChild(img);
      } else {
        im.style.background = tone(p.tone || "purple", "#7643ff");
        im.style.fontSize = Math.min(W(el), H(el)) * 0.34 + "px";
        im.textContent = p.initials || initials(p.label);
      }
      if (p.play) {
        var pl = div("play", el);
        var tri = svgEl("svg", { viewBox: "0 0 24 24", width: 30, height: 30 }, pl);
        svgEl("path", { d: "M8 5v14l11-7z", fill: "#fff" }, tri);
      }
      if (p.label && p.src) c.entity("label", div("cp", el, p.label));
      return {};
    },
  };

  // ================================================================== jargonCloud (§5.6)
  // props {eyebrow?, big: [{label, icon?, tone?}], small: [string], hidden?: true (chips wait for ops)}
  // ops   drop {chip: 1-based big index | label} (333 ms back.out from 1.16 at +135,-46), flood, scatter
  var TILT = [-4, 2.5, -1.5, 3, -3, 1.5, -2, 3.5];
  M.jargonCloud = {
    enter: "fade",
    build: function (el, p, c) {
      var w = W(el);
      var h = H(el);
      var top = 0;
      if (p.eyebrow) {
        var eb = div("bp-eyebrow", el, "? " + String(p.eyebrow).toUpperCase());
        Object.assign(eb.style, { position: "absolute", left: "0px", top: "0px" });
        top = 50;
      }
      var big = (p.big || []).slice(0, 6);
      var bh = 96;
      var bigEls = big.map(function (b, i) {
        var lab = String(b.label || "").toUpperCase();
        var ch = div("bp-jc", el);
        var gi = div("gi", ch);
        Object.assign(gi.style, { width: "57px", height: "57px", background: tone(b.tone || ["purple", "blue", "green", "orange", "pink", "cyan"][i % 6], "#7643ff") });
        var ic = iconNode(b.icon || "zap", 30);
        if (ic) gi.appendChild(ic);
        var fs = fitSize(lab, 800, 30, w * 0.7 - 100, 18);
        div("", ch, lab).style.fontSize = fs + "px";
        var cw = 14 + 57 + 14 + measure(lab, 800, fs) + 24;
        var x = [0.0, 0.42, 0.08, 0.36, 0.02, 0.44][i] * w;
        x = Math.max(0, Math.min(w - cw - 8, x));
        var y = top + i * (bh + 14) * (h - top > 900 ? 1 : 0.92);
        Object.assign(ch.style, { left: x + "px", top: y + "px", height: bh + "px", transform: "rotate(" + TILT[i % TILT.length] + "deg)" });
        if (p.hidden) c.tl.set(ch, { autoAlpha: 0 }, 0);
        c.entity("b" + (i + 1), ch);
        return { el: ch, label: lab, tilt: TILT[i % TILT.length] };
      });
      // small chips flow in the band under the big ones
      var sy = top + big.length * (bh + 14) * (h - top > 900 ? 1 : 0.92) + 10;
      var sx = 0;
      var smEls = (p.small || []).map(function (s, i) {
        var lab = String(s).toUpperCase();
        var cw = measure(lab, 800, 18) + 24 + 12;
        if (sx + cw > w) {
          sx = 0;
          sy += 62;
        }
        var ch = div("bp-jc sm", el, lab);
        Object.assign(ch.style, { left: sx + "px", top: sy + "px", height: "48px", transform: "rotate(" + TILT[(i + 3) % TILT.length] * 0.7 + "deg)" });
        sx += cw + 12;
        if (p.hidden || p.flood) c.tl.set(ch, { autoAlpha: 0 }, 0);
        return ch;
      });
      var dropped = {};
      return {
        ops: {
          drop: function (e) {
            var v = e.value || {};
            var k = typeof v.chip === "number" ? v.chip - 1 : bigEls.findIndex(function (b) {
              return b.label === String(v.chip || "").toUpperCase();
            });
            var b = bigEls[k];
            if (!b) throw new Error("jargonCloud: no big chip " + v.chip);
            dropped[k] = true;
            c.tl.fromTo(b.el, { autoAlpha: 1, scale: 1.16, x: 135, y: -46 }, { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: 0.333, ease: "back.out(1.6)", immediateRender: false }, e.t);
          },
          flood: function (e) {
            bigEls.forEach(function (b, i) {
              if (!dropped[i] && p.hidden) c.tl.fromTo(b.el, { autoAlpha: 0, scale: 1.1 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(1.6)", immediateRender: false }, e.t);
            });
            smEls.forEach(function (s, i) {
              c.tl.fromTo(s, { autoAlpha: 0, scale: 1.12 }, { autoAlpha: 1, scale: 1, duration: 0.2, ease: "back.out(1.6)", immediateRender: false }, e.t + i * 0.033);
            });
          },
          // fly out to the right, 5 f
          scatter: function (e) {
            bigEls.concat(smEls.map(function (s) { return { el: s }; })).forEach(function (b, i) {
              c.tl.to(b.el, { x: 700 + (i % 3) * 60, autoAlpha: 0, duration: 5 * F, ease: "power2.in" }, e.t + (i % 4) * F);
            });
          },
        },
      };
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
