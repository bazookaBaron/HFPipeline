# bbox.py t0 t1 x0 y0 x1 y1 [thr] : per-frame bbox (native px and x1.5) of pixels with luma>thr inside region, and mean luma
import sys, subprocess, numpy as np
V=r"C:/Users/debna/Downloads/igexport-Ddb-aswiHnN.mp4"
t0,t1=float(sys.argv[1]),float(sys.argv[2]); x0,y0,x1,y1=map(int,sys.argv[3:7]); thr=float(sys.argv[7]) if len(sys.argv)>7 else 40
n=int(round((t1-t0)*30))+1
b=subprocess.run(['ffmpeg','-v','error','-ss',f'{t0-0.001:.3f}','-i',V,'-frames:v',str(n),'-f','rawvideo','-pix_fmt','gray','-'],capture_output=True).stdout
fr=np.frombuffer(b,np.uint8).reshape(-1,1280,720)
for i,f in enumerate(fr):
    a=f[y0:y1,x0:x1].astype(float); m=a>thr
    cols=np.where(m.sum(0)>max(3,0.05*m.shape[0]))[0]; rows=np.where(m.sum(1)>max(3,0.05*m.shape[1]))[0]
    bb=(cols[0]+x0,rows[0]+y0,cols[-1]+x0,rows[-1]+y0) if len(cols) and len(rows) else None
    s=f"{t0+i/30:8.3f} mean {a.mean():6.1f}"
    if bb: s+=f"  bbox native {bb}  1080: x {bb[0]*1.5:.0f}-{(bb[2]+1)*1.5:.0f} y {bb[1]*1.5:.0f}-{(bb[3]+1)*1.5:.0f} ({(bb[2]-bb[0]+1)*1.5:.0f}x{(bb[3]-bb[1]+1)*1.5:.0f})"
    print(s)
