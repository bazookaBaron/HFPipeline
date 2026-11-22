#!/bin/bash
# waits for parler setup, then for GPU used < 1200 MiB; gives up after 45 min total
start=$(date +%s)
while ! grep -q SETUP_DONE /c/Repos/HFPipleine/dialogue/voice/setup_parler.log 2>/dev/null; do
  if ! pgrep -f setup_parler.sh >/dev/null && ! tasklist | grep -qi "bash.exe.*" ; then :; fi
  if grep -qiE "error|Traceback" /c/Repos/HFPipleine/dialogue/voice/setup_parler.log 2>/dev/null; then echo SETUP_ERROR; exit 2; fi
  sleep 60
done
echo "setup done after $(( $(date +%s)-start ))s"
while true; do
  used=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -1)
  echo "$(date +%T) gpu used $used"
  [ "$used" -lt 1200 ] && { echo GPU_FREE; exit 0; }
  [ $(( $(date +%s)-start )) -gt 2700 ] && { echo GPU_TIMEOUT; exit 3; }
  sleep 180
done
