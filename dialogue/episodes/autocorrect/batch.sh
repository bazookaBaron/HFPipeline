# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/autocorrect/out; R="node dialogue/engine/render.mjs"
$R epgate autocorrect > $O/epgate.log 2>&1
$R epeval autocorrect dialogue/episodes/autocorrect/headcheck.js > $O/headcheck.log 2>&1
$R sheet autocorrect > $O/sheet.log 2>&1
node dialogue/episodes/autocorrect/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo autocorrect > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
