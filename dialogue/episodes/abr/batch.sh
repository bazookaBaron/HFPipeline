# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/abr/out; R="node dialogue/engine/render.mjs"
$R epgate abr > $O/epgate.log 2>&1
$R epeval abr dialogue/episodes/abr/headcheck.js > $O/headcheck.log 2>&1
$R sheet abr > $O/sheet.log 2>&1
node dialogue/episodes/abr/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo abr > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
