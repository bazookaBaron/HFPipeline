# one queued job: engine gates + head check + contact sheet + MG sheet + full render (single RAM wait)
cd /c/Repos/HFPipleine; O=dialogue/episodes/incognito/out; R="node dialogue/engine/render.mjs"
$R epgate incognito > $O/epgate.log 2>&1
$R epeval incognito dialogue/episodes/incognito/headcheck.js > $O/headcheck.log 2>&1
$R sheet incognito > $O/sheet.log 2>&1
node dialogue/episodes/incognito/mgsheet.mjs > $O/mgsheet.log 2>&1
T0=$(date +%s); $R epvideo incognito > $O/epvideo.log 2>&1; echo "render_s $(( $(date +%s)-T0 ))" >> $O/epvideo.log
