import sys, json, numpy as np, librosa
slug=sys.argv[1]; sys.argv=[sys.argv[0],slug,'x']
exec(open('voice_ep.py',encoding='utf8').read().split('if cmd == "tts":')[0])
for k,idx in enumerate(B):
    w=json.load(open(T/f"B{k}.json")); al=lines_words(w,idx); y,sr=librosa.load(T/f"B{k}.mp3",sr=16000)
    for n in idx:
        i0,i1=al[n]; a,b=w[i0][0],w[i1-1][1]
        f0,vf,_=librosa.pyin(y[int(a*sr):int((b+.1)*sr)],fmin=70,fmax=420,sr=sr); f=f0[vf&~np.isnan(f0)]
        p=np.percentile(f,[20,50,80]).round().astype(int).tolist() if len(f) else None
        print(f"L{n+1:2d} {L[n][0]:6s} B{k} {p} {' '.join(x[2] for x in w[i0:i1])}")
