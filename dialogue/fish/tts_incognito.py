"""Fish REST TTS for the incognito episode: drama-3, speaker 0 = Leo (Stickzy), 1 = Walter (Adrian).
Usage: python tts_incognito.py A|B|C|R<line>   (lines from ../episodes/incognito/script.md). Writes take_incognito/<id>.mp3 + .txt"""
import sys, re, json, urllib.request, fishkey
from pathlib import Path
D=Path(__file__).parent; S=D.parent/"episodes"/"incognito"/"script.md"
LEO,WAL="55046bd7267d4a618380d1e8f93a056a","bf322df2096a46f18c579d0baa36f41d"
lines=[]
for l in S.read_text(encoding="utf8").split("#end")[0].splitlines():
    m=re.match(r"(LEO|WALTER) \(([^)]*)\) \[[^\]]*\]: (.*)",l)
    if m: lines.append((m[1],m[2],m[3]))
B={"A":range(0,6),"B":range(6,12),"C":range(12,18)}
k=sys.argv[1]; idx=B[k] if k in B else [int(k[1:])-1]
txt="".join(f"<|speaker:{0 if lines[i][0]=='LEO' else 1}|>[{lines[i][1]}] {lines[i][2]}" for i in idx)
if k.startswith("R"):  # single-line re-roll: one speaker only, no tags, so the voice cannot swap
    sp,emo,t=lines[idx[0]]; txt=f"[{emo}] {t}"; ref=LEO if sp=="LEO" else WAL
else: ref=[LEO,WAL]
body={"text":txt,"reference_id":ref,"format":"mp3","mp3_bitrate":192,"latency":"normal"}
req=urllib.request.Request("https://api.fish.audio/v1/tts",data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+fishkey.key(),"Content-Type":"application/json","model":"drama-3"})
try: a=urllib.request.urlopen(req,timeout=300).read()
except urllib.error.HTTPError as e: print("HTTP",e.code,e.read()[:400]); sys.exit(1)
(D/"take_incognito"/f"{k}.mp3").write_bytes(a); (D/"take_incognito"/f"{k}.txt").write_text(txt,encoding="utf8")
print(k,len(txt.encode()),"bytes ->",len(a),"B audio")
