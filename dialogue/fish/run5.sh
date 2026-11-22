cd /c/Repos/HFPipleine/dialogue/fish
python voice_tighten5.py && /c/Repos/HFPipleine/.venvs/whisper/Scripts/python.exe asr.py voice5.wav words5.json && python mix5.py
export EARSHOT_HOME=C:/Repos/HFPipleine/.vendor/hf-earshot HF_HOME=C:/Repos/HFPipleine/.vendor/hf-earshot EARSHOT_THREADS=3 JOBQ_MIN_FREE_GB=0.5
cd /c/Repos/HFPipleine && node runtime/jobq.js --kind light -- "C:\Repos\HFPipleine\.vendor\earshot\.venv\Scripts\python.exe" "C:\Repos\HFPipleine\dialogue\fish\analyze5.py" "C:\Repos\HFPipleine\dialogue\fish\voice5.wav" "C:\Repos\HFPipleine\dialogue\fish\words5.json" "C:\Repos\HFPipleine\dialogue\fish\analysis5.json" > dialogue/fish/analysis5.log 2>&1
echo ALLDONE
