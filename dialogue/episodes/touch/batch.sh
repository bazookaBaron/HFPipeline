# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/touch/out; R="node dialogue/engine/render.mjs"
$R epgate touch > $O/epgate.log 2>&1
$R epeval touch dialogue/episodes/touch/headcheck.js > $O/headcheck.log 2>&1
$R sheet touch > $O/sheet.log 2>&1
node dialogue/episodes/touch/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo touch > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
