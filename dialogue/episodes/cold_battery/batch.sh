# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/cold_battery/out; R="node dialogue/engine/render.mjs"
$R epgate cold_battery > $O/epgate.log 2>&1
$R epeval cold_battery dialogue/episodes/cold_battery/headcheck.js > $O/headcheck.log 2>&1
$R sheet cold_battery > $O/sheet.log 2>&1
node dialogue/episodes/cold_battery/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo cold_battery > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
