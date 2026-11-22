# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/ytrec/out; R="node dialogue/engine/render.mjs"
$R epgate ytrec > $O/epgate.log 2>&1
$R epeval ytrec dialogue/episodes/ytrec/headcheck.js > $O/headcheck.log 2>&1
$R sheet ytrec > $O/sheet.log 2>&1
node dialogue/episodes/ytrec/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo ytrec > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
