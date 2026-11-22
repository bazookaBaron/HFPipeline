# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/gps2/out; R="node dialogue/engine/render.mjs"
$R epgate gps2 > $O/epgate.log 2>&1
$R epeval gps2 dialogue/episodes/gps2/headcheck.js > $O/headcheck.log 2>&1
$R sheet gps2 > $O/sheet.log 2>&1
node dialogue/episodes/gps2/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo gps2 > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
