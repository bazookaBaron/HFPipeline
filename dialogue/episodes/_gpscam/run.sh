cd /c/Repos/HFPipleine
R="node dialogue/engine/render.mjs"
T0=$(date +%s)
$R epgate gps | grep -E "epgate|FAIL"
$R epvideo gps | grep -E "epvideo|FAIL"
echo "render_s $(( $(date +%s)-T0 ))"
$R sheet gps | grep -E "sheet|FAIL"
echo ALLDONE
