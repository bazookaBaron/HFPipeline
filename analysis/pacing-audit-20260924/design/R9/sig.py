# per-frame region signals at half-res (360x640 gray). Regions in NATIVE px (720x1280).
import subprocess, numpy as np, json, sys
V=r"C:/Users/debna/Downloads/igexport-Ddb-aswiHnN.mp4"
W,H=360,640
REG={ # native x0,y0,x1,y1
 'hud':(0,120,720,165),'panel':(40,178,682,675),'card':(40,705,402,880),'cardcap':(40,880,402,908),
 'mascot':(425,520,715,920),'cap':(100,955,620,1040),'left_lower':(40,675,425,955),'all':(0,0,720,1280)}
p=subprocess.Popen(['ffmpeg','-v','error','-i',V,'-vf',f'scale={W}:{H}','-f','rawvideo','-pix_fmt','gray','-'],stdout=subprocess.PIPE)
prev=None; rows=[]; small=[]
i=0
while True:
    b=p.stdout.read(W*H)
    if len(b)<W*H: break
    f=np.frombuffer(b,np.uint8).reshape(H,W).astype(np.int16)
    r={'i':i,'t':round(i/30,3)}
    for k,(x0,y0,x1,y1) in REG.items():
        a=f[y0//2:y1//2,x0//2:x1//2]
        r[k+'_m']=round(float(a.mean()),2)
        r[k+'_d']=round(float(np.abs(a-prev[y0//2:y1//2,x0//2:x1//2]).mean()),3) if prev is not None else 0
    rows.append(r); small.append(f[::4,::4].astype(np.uint8)); prev=f; i+=1
np.save('small.npy',np.stack(small))
json.dump(rows,open('sig.json','w'))
print(i)
