# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/wifi_crowd/out; R="node dialogue/engine/render.mjs"
$R epgate wifi_crowd > $O/epgate.log 2>&1
$R epeval wifi_crowd dialogue/episodes/wifi_crowd/headcheck.js > $O/headcheck.log 2>&1
$R sheet wifi_crowd > $O/sheet.log 2>&1
T0=$(date +%s); $R epvideo wifi_crowd > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
