# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/url_enter/out; R="node dialogue/engine/render.mjs"
$R epgate url_enter > $O/epgate.log 2>&1
$R epeval url_enter dialogue/episodes/url_enter/headcheck.js > $O/headcheck.log 2>&1
$R sheet url_enter > $O/sheet.log 2>&1
node dialogue/episodes/url_enter/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo url_enter > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
