"""Within-batch speaker check (batch timbre differs, so compare lines only inside the same batch): 2-means on MFCC + f0 stats must split Leo/Walter exactly."""
import sys, json, re, numpy as np, librosa
sys.argv=[sys.argv[0],sys.argv[1],'x']
import importlib.util
slug=sys.argv[1]
spec=importlib.util.spec_from_file_location('ve','voice_ep.py')
src=open('voice_ep.py',encoding='utf8').read().split('if cmd == "tts":')[0]
exec(src)
for k,idx in enumerate(B):
    if len(idx)<3: continue
    w=json.load(open(T/f"B{k}.json")); al=lines_words(w,idx); y,sr=librosa.load(T/f"B{k}.mp3",sr=16000)
    F=[]
    for n in idx:
        i0,i1=al[n]; a,b=w[i0][0],w[i1-1][1]; F.append(feat(y,sr,a,b))
    X=np.array(F); X=(X-X.mean(0))/(X.std(0)+1e-6)
    sp=np.array([1 if L[n][0]=='LEO' else 0 for n in idx])
    # centroid by script label; distance of each line to both
    out=[]
    for j,n in enumerate(idx):
        m=[i for i in range(len(idx)) if i!=j]
        cL=X[[i for i in m if sp[i]==1]].mean(0); cW=X[[i for i in m if sp[i]==0]].mean(0)
        dL=np.linalg.norm(X[j]-cL); dW=np.linalg.norm(X[j]-cW); ok=(dL<dW)==(sp[j]==1)
        out.append(f"L{n+1}:{'ok' if ok else 'SWAP?'}({dL:.1f}/{dW:.1f})")
    print(f"B{k}",' '.join(out))
