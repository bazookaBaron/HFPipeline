import json, numpy as np, librosa
E=json.load(open('remake/A/idx_proof/emb.json')); L=json.load(open('remake/A/idx_proof/list.json'))
R=json.load(open('../ref/voice_study/A.turns.json'))['turns']; TT={t['turn']:t for t in R}
sr=24000
def f(p):
    x,_=librosa.load(p,sr=sr); idx=np.where(np.abs(x)>0.01)[0]; x=x[idx[0]:idx[-1]] if len(idx) else x
    f0,vf,_=librosa.pyin(x,fmin=60,fmax=550,sr=sr,hop_length=240); f0=f0[vf&~np.isnan(f0)]
    st=12*np.log2(f0/np.median(f0)) if len(f0)>4 else np.array([0.])
    S=np.abs(librosa.stft(x,n_fft=1024,hop_length=240))**2; fr=librosa.fft_frequencies(sr=sr,n_fft=1024)
    db=10*np.log10(S.sum(0)+1e-9); tilt=10*np.log10((S[(fr>2000)&(fr<5000)].sum(0)+1e-9)/(S[(fr>100)&(fr<1000)].sum(0)+1e-9))[db>db.max()-25]
    th=[round(float(np.median(c)),1) for c in np.array_split(st,3)]
    return np.median(f0) if len(f0) else 0, np.percentile(st,90)-np.percentile(st,10), np.median(tilt), len(x)/sr, th
cos=lambda a,b: float(np.dot(E[a]['ecapa'],E[b]['ecapa']))
pr={'USER':L[0],'CLAUDE':L[1]}
print('turn ver  medHz  range_st  bright_dB  dur_s  contour(thirds)   sim_ourvoice  sim_refspeaker')
for i,t in enumerate([3,8,9,13,17,18]):
    ps=L[2+4*i:6+4*i]; role=TT[t]['role']
    for name,p in zip(['ref','A_omni','B_emoref','C_vec'],ps):
        h,rg,tl,d,th=f(p)
        print(f"{t:3d} {role:6s} {name:8s} {h:5.0f} {rg:6.1f} {tl:8.1f} {d:6.2f}  {str(th):20s} {cos(p,pr[role]):.2f}  {cos(p,ps[0]):.2f}")
