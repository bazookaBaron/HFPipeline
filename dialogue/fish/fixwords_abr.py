"""Correct Whisper word starts after pauses against audio energy: a word whose start falls inside a silent run (>=0.2 s) of the final track is moved to the run's end (the real onset).
Usage: python fixwords_abr.py voice_abr.wav words_abr.json  (rewrites words_abr.json, keeps words_abr.raw.json)"""
import sys, json, subprocess, numpy as np, shutil
SR=16000
x=np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",sys.argv[1],"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True).stdout,dtype="<f4")
win=int(.01*SR); n=len(x)//win; env=np.sqrt((x[:n*win].reshape(n,win)**2).mean(1)); TH=10**(-38/20)
sil=env<TH; runs=[]; i=0
while i<n:
    if sil[i]:
        j=i
        while j<n and sil[j]: j+=1
        if (j-i)*.01>=.2: runs.append((i*.01,j*.01))
        i=j
    else: i+=1
w=json.load(open(sys.argv[2])); shutil.copy(sys.argv[2],sys.argv[2].replace(".json",".raw.json"))
ch=[]
for a,b in runs:
    for k,q in enumerate(w):
        if a-0.05<=q[0]<b-0.03 or (q[0]<a-0.05 and q[1]>a+0.15 and q[0]>=a-0.2):   # start inside the silence, or the word spans it (Whisper put it ~0.2 s early)
            ch.append((q[2],q[0],round(b,2),round(b-q[0],2))); q[0]=round(b,2)
            if q[1]<q[0]+.05: q[1]=round(q[0]+.1,2)
            break
for c in ch: print("word %-12s whisper %.2f -> onset %.2f (%.2f s early)"%c)
print(len(runs),"silent runs,",len(ch),"starts corrected")
json.dump(w,open(sys.argv[2],"w"))
