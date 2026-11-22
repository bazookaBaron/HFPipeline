# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/faceid/out; R="node dialogue/engine/render.mjs"
$R epgate faceid > $O/epgate.log 2>&1
$R epeval faceid dialogue/episodes/faceid/headcheck.js > $O/headcheck.log 2>&1
$R sheet faceid > $O/sheet.log 2>&1
node dialogue/episodes/faceid/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo faceid > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
