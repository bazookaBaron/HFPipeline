from PIL import Image; import numpy as np
h=lambda p:'#%02x%02x%02x'%tuple(int(round(v)) for v in p)
_c={}
def load(t):
    import glob
    if isinstance(t,str) and not t.endswith('.png'):
        f=glob.glob(f'../ref_frames/R5_{t}*.png')[0]
    else: f=t
    if f not in _c: _c[f]=np.array(Image.open(f).convert('RGB')).astype(int)
    return _c[f]
def box(im,x,y,thr=6,maxd=500):
    """scan from interior (x,y) outwards; stop where colour jumps by >thr from interior fill"""
    L=im.mean(2); f=np.median(im[y-1:y+2,x-1:x+2].reshape(-1,3),0); fl=f.mean()
    out={}
    for nm,dx,dy in (('L',-1,0),('R',1,0),('T',0,-1),('B',0,1)):
        xx,yy=x,y
        for _ in range(maxd):
            xx+=dx; yy+=dy
            if not(0<=xx<im.shape[1] and 0<=yy<im.shape[0]): break
            if abs(L[yy,xx]-fl)>thr: break
        # border thickness: count consecutive pixels differing
        bx,by=xx,yy; n=0; col=[]
        while 0<=bx<im.shape[1] and 0<=by<im.shape[0] and abs(L[by,bx]-fl)>thr and n<12:
            col.append(im[by,bx]); bx+=dx; by+=dy; n+=1
        out[nm]=(xx if dx else yy, n, h(np.max(col,0)) if col else '-')
    return h(f), out
def textbox(im,x0,y0,x1,y1,thr=None):
    L=im[y0:y1,x0:x1].mean(2)
    if thr is None: thr=L.min()+0.5*(L.max()-L.min())
    ys,xs=np.where(L>thr)
    if len(ys)==0: return None
    reg=im[y0:y1,x0:x1].reshape(-1,3); l=reg.mean(1)
    return dict(y=(y0+ys.min(),y0+ys.max()),x=(x0+xs.min(),x0+xs.max()),h=ys.max()-ys.min()+1,col=h(reg[l>=np.percentile(l,99.5)].mean(0)))
def S(v): return round(v*1.5,1)
def runs(t,axis,pos,a,b,tol=5):
    """compress a row (axis='x', pos=y) or column (axis='y', pos=x) into runs of similar colour"""
    im=load(t)
    px=[im[pos,i] if axis=='x' else im[i,pos] for i in range(a,b)]
    out=[];s=a;cur=px[0]
    for i in range(1,len(px)+1):
        if i==len(px) or np.abs(px[i]-cur).max()>tol:
            out.append(f'{s}-{a+i-1}:{h(np.mean(px[s-a:i],0))[1:]}' if a+i-1>s else f'{s}:{h(px[s-a])[1:]}')
            if i<len(px): s=a+i; cur=px[i]
    return ' '.join(out)
def zoom(t,x0,y0,x1,y1,out,z=4,step=10):
    from PIL import ImageDraw
    im=Image.fromarray(load(t).astype(np.uint8)).crop((x0,y0,x1,y1)).resize(((x1-x0)*z,(y1-y0)*z),Image.NEAREST)
    c=Image.new('RGB',(im.width+40,im.height+20),(40,0,40)); c.paste(im,(40,20)); d=ImageDraw.Draw(c)
    for x in range((x0//step+1)*step,x1,step):
        X=40+(x-x0)*z; d.line([(X,14),(X,20)],fill=(255,255,0)); 
        if x%(step*2)==0: d.text((X-8,2),str(x),fill=(255,255,0))
    for y in range((y0//step+1)*step,y1,step):
        Y=20+(y-y0)*z; d.line([(34,Y),(40,Y)],fill=(255,255,0)); 
        if y%(step*2)==0: d.text((2,Y-5),str(y),fill=(255,255,0))
    c.save(out)
