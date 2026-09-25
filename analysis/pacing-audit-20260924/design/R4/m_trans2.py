from m_frames import frames
import numpy as np, sys
BG=np.array([244,244,237])
def vshift(a,b,maxs=12):
    # integer+parabolic vertical shift of grayscale a relative to b
    best=[];ga=a.mean(-1);gb=b.mean(-1)
    for s in range(-maxs,maxs+1):
        if s>=0: e=((ga[s:]-gb[:ga.shape[0]-s])**2).mean()
        else: e=((ga[:s]-gb[-s:])**2).mean()
        best.append(e)
    best=np.array(best);i=int(np.argmin(best))
    if 0<i<len(best)-1:
        l,c,r=best[i-1],best[i],best[i+1];d=l-2*c+r;o=0.5*(l-r)/d if d else 0
    else:o=0
    return i-maxs+o
def run(T,regions,pre=0.07,post=0.6):
    F=frames(T-pre,T+post); B=F[-1][1]; A=F[0][1]
    print(f'== T={T}')
    for name,(x0,y0,x1,y1) in regions.items():
        b=B[y0:y1,x0:x1]; a=A[y0:y1,x0:x1]
        dB=np.abs(b-BG).sum(-1); dA=np.abs(a-BG).sum(-1); m=(dB>60)&(dA<15)
        row=[]
        for t,f in F:
            c=f[y0:y1,x0:x1]; d=np.abs(c-BG).sum(-1)
            op=d[m].mean()/dB[m].mean() if m.sum() else np.nan
            sh=vshift(c,b) if op>0.15 else np.nan
            row.append(f'{op:.2f}/{sh:+.1f}')
        print(f'{name:9s}',' '.join(row))
    print('t:',' '.join(f'{t:.3f}' for t,_ in F))
if __name__=='__main__':
    R={'title':(40,190,700,300),'subtitle':(40,305,700,340),'content':(205,360,700,860),'footnote':(205,875,700,905)}
    for T in map(float,sys.argv[1:]): run(T,R)
