import numpy as np,glob,sys
from PIL import Image
B=8
def photo_blocks(p):
    a=np.asarray(Image.open(p).convert('L')).astype(np.int16)
    t=(np.abs(np.diff(a,axis=1))[:-1,:]+np.abs(np.diff(a,axis=0))[:,:-1])>3
    lit=a[:-1,:-1]>22
    H,W=t.shape; H//=B;W//=B
    tb=t[:H*B,:W*B].reshape(H,B,W,B).mean((1,3)); lb=lit[:H*B,:W*B].reshape(H,B,W,B).mean((1,3))
    return (tb>0.45)&(lb>0.5)
def comp(m):
    H,W=m.shape;lab=np.zeros_like(m,int);best=None;n=0
    for y in range(H):
        for x in range(W):
            if m[y,x] and not lab[y,x]:
                n+=1;st=[(y,x)];lab[y,x]=n;cells=[]
                while st:
                    cy,cx=st.pop();cells.append((cy,cx))
                    for dy,dx in((1,0),(-1,0),(0,1),(0,-1)):
                        yy,xx=cy+dy,cx+dx
                        if 0<=yy<H and 0<=xx<W and m[yy,xx] and not lab[yy,xx]: lab[yy,xx]=n;st.append((yy,xx))
                if best is None or len(cells)>len(best): best=cells
    return best
fs=sorted(glob.glob('f10/*.jpg'))
step=int(sys.argv[1]) if len(sys.argv)>1 else 10
out=open('photo_scan.txt','w')
for i in range(0,len(fs),step):
    m=photo_blocks(fs[i]); m[118:,:]=False  # skip caption band (native y>=944)
    c=comp(m)
    if not c or len(c)<40: out.write('%.1f none\n'%((i+1)/10-0.1)); continue
    ys=[y for y,x in c]; xs=[x for y,x in c]
    y0,y1,x0,x1=min(ys),max(ys)+1,min(xs),max(xs)+1
    fill=len(c)/((y1-y0)*(x1-x0))
    out.write('%.1f %d %d %d %d n=%d fill=%.2f\n'%(i/10,x0*B*1.5,y0*B*1.5,x1*B*1.5,y1*B*1.5,len(c),fill))
