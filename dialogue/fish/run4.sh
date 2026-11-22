cd /c/Repos/HFPipleine/dialogue/fish
python voice_tighten4.py && /c/Repos/HFPipleine/.venvs/whisper/Scripts/python.exe asr.py voice4.wav words4.json && python mix4.py
export EARSHOT_HOME=C:/Repos/HFPipleine/.vendor/hf-earshot HF_HOME=C:/Repos/HFPipleine/.vendor/hf-earshot EARSHOT_THREADS=3 JOBQ_MIN_FREE_GB=0.5
cd /c/Repos/HFPipleine && node runtime/jobq.js --kind light -- "C:\Repos\HFPipleine\.vendor\earshot\.venv\Scripts\python.exe" "C:\Repos\HFPipleine\dialogue\fish\analyze.py" "C:\Repos\HFPipleine\dialogue\fish\voice4.wav" "C:\Repos\HFPipleine\dialogue\fish\words4.json" "C:\Repos\HFPipleine\dialogue\fish\analysis4.json" > dialogue/fish/analysis4.log 2>&1
echo ALLDONE
