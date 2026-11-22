#!/bin/bash
# Stall watchdog for long jobs (2026-10-24: a voice job sat 2.5 h at zero progress unnoticed).
#   stallwatch.sh <minutes> <dir> [<dir>...]
# Prints one line per event, for a Monitor:
#   PROGRESS <n> new files      (at most once per check)
#   STALL <dirs> no new output for <minutes> min   -> tell the user at once, then fix
#   GPU_CONTENTION chatterbox + comfyui both alive -> stop one now
# Exits when the watched dirs have been quiet for 3x <minutes> after a STALL was already reported.
MIN=${1:-5}; shift; DIRS="$@"; stamp=$(mktemp); touch "$stamp"; stalled=0; quiet=0
while true; do
  sleep 60
  n=$(find $DIRS -newer "$stamp" -type f 2>/dev/null | wc -l)
  if [ "$n" -gt 0 ]; then touch "$stamp"; stalled=0; quiet=0; echo "PROGRESS $n new files $(date +%H:%M)"; else quiet=$((quiet + 1)); fi
  if [ "$quiet" -ge "$MIN" ] && [ "$stalled" -eq 0 ]; then echo "STALL $DIRS: no new output for $MIN min ($(date +%H:%M))"; stalled=1; fi
  c=$(powershell -NoProfile -c "(Get-CimInstance Win32_Process | ? { \$_.Name -match '^python' -and \$_.CommandLine -match 'chatterbox-venv' }).Count; (Get-CimInstance Win32_Process | ? { \$_.Name -match '^python' -and \$_.CommandLine -match 'ComfyUI.main.py|ComfyUI\\\\main.py' }).Count" 2>/dev/null | tr -d '\r' | paste -sd' ')
  set -- $c; [ "${1:-0}" -gt 0 ] && [ "${2:-0}" -gt 0 ] && echo "GPU_CONTENTION chatterbox=$1 comfyui=$2 ($(date +%H:%M))"
  [ "$stalled" -eq 1 ] && [ "$quiet" -ge $((MIN * 3)) ] && exit 1
done
