from m_frames import frames
import numpy as np, sys
BG=np.array([244,244,237])
def profile(T, pre=0.2, post=0.6, region=(0,190,720,1090), th=60):
    x0,y0,x1,y1=region
    F=frames(T-pre,T+post)
    A=F[0][1][y0:y1,x0:x1]; B=F[-1][1][y0:y1,x0:x1]
    dA=np.abs(A-BG).sum(-1); dB=np.abs(B-BG).sum(-1)
    mOld=(dA>th)&(dB<15); mNew=(dB>th)&(dA<15)
    out=[]
    for t,f in F:
        f=f[y0:y1,x0:x1]; d=np.abs(f-BG).sum(-1)
        old=d[mOld].mean()/dA[mOld].mean() if mOld.sum() else float('nan')
        new=d[mNew].mean()/dB[mNew].mean() if mNew.sum() else float('nan')
        # vertical offset of new content: centroid of mNew-weighted diff
        out.append((t,old,new))
    return out, mOld.sum(), mNew.sum()
if __name__=='__main__':
    T=float(sys.argv[1]); reg=tuple(map(int,sys.argv[2].split(','))) if len(sys.argv)>2 else (0,190,720,1090)
    o,a,b=profile(T,region=reg)
    print('maskOld',a,'maskNew',b)
    for t,old,new in o: print(f'{t:.3f} old {old:.2f} new {new:.2f}')
