"""Per-line median f0 of the compress takes using hand-set line starts (ASR word index drifts on digits). Leo should be higher than Walter."""
import sys, numpy as np, librosa
from pathlib import Path
D=Path(__file__).parent/"take_cold"
S={"A":[(1,"LEO",0.0),(2,"WAL",5.96),(3,"LEO",9.56),(4,"WAL",12.12),(5,"LEO",21.96),(6,"WAL",23.54)],
   "B":[(7,"LEO",0.0),(8,"WAL",1.4),(9,"LEO",10.34),(10,"WAL",13.32),(11,"LEO",16.24),(12,"WAL",18.36)],
   "C":[(13,"LEO",0.0),(14,"WAL",3.18),(15,"LEO",8.68),(16,"WAL",10.44),(17,"LEO",13.62),(18,"WAL",15.96)]}
for k,L in S.items():
    y,sr=librosa.load(D/f"{k}.mp3",sr=16000)
    for i,(n,sp,a) in enumerate(L):
        b=L[i+1][2] if i+1<len(L) else len(y)/sr
        f0,_,_=librosa.pyin(y[int(a*sr):int(b*sr)],fmin=60,fmax=450,sr=sr); f=f0[~np.isnan(f0)]
        print(f"L{n:2d} {sp} {a:5.2f}-{b:5.2f} f0={np.median(f) if len(f) else 0:4.0f}")
