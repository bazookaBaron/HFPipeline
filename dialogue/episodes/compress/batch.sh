# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/compress/out; R="node dialogue/engine/render.mjs"
$R epgate compress > $O/epgate.log 2>&1
$R epeval compress dialogue/episodes/compress/headcheck.js > $O/headcheck.log 2>&1
$R sheet compress > $O/sheet.log 2>&1
node dialogue/episodes/compress/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo compress > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
