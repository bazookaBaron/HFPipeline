# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/qr/out; R="node dialogue/engine/render.mjs"
$R epgate qr > $O/epgate.log 2>&1
$R epeval qr dialogue/episodes/qr/headcheck.js > $O/headcheck.log 2>&1
$R sheet qr > $O/sheet.log 2>&1
node dialogue/episodes/qr/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo qr > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
