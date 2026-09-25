from m_mot import *
S=1.5
def P(label,t0,t1,fn):
    print('==',label)
    for t,a in frames(t0,t1): print('%.3f'%t, fn(a))
def red(r): return (r[:,:,0]>170)&(r[:,:,1]<110)&(r[:,:,2]<140)
def slam(a):
    r=a[215:300,500:690]; m=red(r); b=bb(m)
    return 'none' if not b else 'x %.1f-%.1f y %.1f-%.1f w %.1f h %.1f n=%d meanR %.0f'%((b[0]+500)*S,(b[2]+500)*S,(b[1]+215)*S,(b[3]+215)*S,(b[2]-b[0])*S,(b[3]-b[1])*S,b[4],r[m][:,0].mean())
P('E6 18% slam',71.37,71.67,slam)
def eline(a):
    r=a[310:510,220:690]; m=red(r)|((r[:,:,0]>200)&(r[:,:,1]>80)&(r[:,:,1]<170)&(r[:,:,2]<100)); b=bb(m)
    return 'none' if not b else 'right x %.1f  top y %.1f n=%d'%((b[2]+220)*S,(b[1]+310)*S,b[4])
P('E8 error line draw',69.85,70.75,eline)
