import sys,glob,numpy as np
from PIL import Image
def L(p):
    a=np.asarray(Image.open(p).convert('RGB')).astype(int); return a,(a[...,0]*299+a[...,1]*587+a[...,2]*114)//1000
def edges(l,x0,x1,y0,y1,th=6):
    # rows inside [y0,y1] whose std over columns x0..x1 > th; longest run
    def run(v):
        best=(0,-1);s=None
        for i,x in enumerate(list(v)+[False]):
            if x and s is None:s=i
            if not x and s is not None:
                if i-1-s>best[1]-best[0]:best=(s,i-1)
                s=None
        return best
    rs=l[y0:y1,x0:x1].std(1)>th; r=run(rs); Y0,Y1=y0+r[0],y0+r[1]
    cs=l[Y0:Y1+1,:].std(0)>th; cs[:x0]=False; cs[x1:]=False; c=run(cs)
    return c[0],Y0,c[1],Y1
if __name__=='__main__':
    for p in sys.argv[1:]:
        a,l=L(p)
        # coarse: find window by header? use provided search box full frame minus caption/top
        x0,Y0,x1,Y1=edges(l,170,715,150,930)  # skip mascot col for pass 1
        # extend left: columns with std>6 over the found rows
        cs=l[Y0:Y1+1,:].std(0)>6
        xl=x0
        while xl>0 and cs[xl-1]: xl-=1
        print(p, 'native x %d-%d y %d-%d'%(xl,x1,Y0,Y1),' @1080: x %.1f-%.1f y %.1f-%.1f  w %.1f h %.1f  AR %.3f'%(xl*1.5,(x1+1)*1.5,Y0*1.5,(Y1+1)*1.5,(x1+1-xl)*1.5,(Y1+1-Y0)*1.5,(x1+1-xl)/(Y1+1-Y0)))
