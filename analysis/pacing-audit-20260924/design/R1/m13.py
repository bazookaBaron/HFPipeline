from grab import *
import subprocess,glob,os
def frames(t0,t1,tag):
    d=f"fr/{tag}"; os.makedirs(d,exist_ok=True)
    if not glob.glob(d+"/*.png"):
        subprocess.run(["ffmpeg","-v","error","-ss",f"{t0}","-i",V,"-t",f"{t1-t0}",d+"/%04d.png"],check=True)
    return [np.asarray(Image.open(f).convert("RGB")).astype(int) for f in sorted(glob.glob(d+"/*.png"))]
def mascot(a):
    # silhouette: non-black pixels in columns 0..(dynamic) where mascot, choose column band x<150 for vertical extent
    band=a[150:900,0:150].max(2)>50
    rows=np.where(band.sum(1)>3)[0]
    top=rows.min()+150 if len(rows) else None; bot=rows.max()+150 if len(rows) else None
    # width at row of knees band: row 820
    return top,bot
import sys
if __name__=="__main__":
    for (t0,t1,tag) in [(9.0,9.8,"p9"),(10.35,10.7,"p10"),(39.7,40.2,"p39"),(43.3,43.6,"p43"),(48.0,48.3,"p48"),(174.85,175.3,"p175"),(0.0,0.4,"p0")]:
        fs=frames(t0,t1,tag)
        print(tag, " ".join(f"{t0+i/30:.3f}:{mascot(f)}" for i,f in enumerate(fs)))
