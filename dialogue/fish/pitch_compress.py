"""Per-line median f0 of the compress takes using hand-set line starts (ASR word index drifts on digits). Leo should be higher than Walter."""
import sys, numpy as np, librosa
from pathlib import Path
D=Path(__file__).parent/"take_compress"
S={"A":[(1,"LEO",0.0),(2,"WAL",6.98),(3,"LEO",10.48),(4,"WAL",12.32),(5,"LEO",17.36),(6,"WAL",19.88)],
   "B":[(7,"LEO",0.0),(8,"WAL",3.1),(9,"LEO",10.34),(10,"WAL",14.02),(11,"LEO",25.42),(12,"WAL",26.28)],
   "C":[(13,"LEO",0.0),(14,"WAL",2.6),(15,"LEO",6.7),(16,"WAL",10.06),(17,"LEO",17.16),(18,"WAL",22.34)]}
for k,L in S.items():
    y,sr=librosa.load(D/f"{k}.mp3",sr=16000)
    for i,(n,sp,a) in enumerate(L):
        b=L[i+1][2] if i+1<len(L) else len(y)/sr
        f0,_,_=librosa.pyin(y[int(a*sr):int(b*sr)],fmin=60,fmax=450,sr=sr); f=f0[~np.isnan(f0)]
        print(f"L{n:2d} {sp} {a:5.2f}-{b:5.2f} f0={np.median(f) if len(f) else 0:4.0f}")
