from mlib import *
import glob, sys
for f in sorted(glob.glob('../ref_frames/R5_*.png')):
    im=load(f); mx=im.max(2); mn=im.min(2); sat=(mx-mn)/np.maximum(mx,1)
    m=(sat>0.3)&(mx>50)
    m[500:930,0:310]=False  # mascot
    m[940:1060,:]=False     # caption
    B=6; H,W=m.shape; g=m[:H//B*B,:W//B*B].reshape(H//B,B,W//B,B).sum((1,3))>0
    seen=np.zeros_like(g); out=[]
    for sy in range(g.shape[0]):
      for sx in range(g.shape[1]):
        if g[sy,sx] and not seen[sy,sx]:
          st=[(sy,sx)]; seen[sy,sx]=1; cells=[]
          while st:
            cy,cx=st.pop(); cells.append((cy,cx))
            for dy in (-1,0,1):
              for dx in (-1,0,1):
                ny,nx=cy+dy,cx+dx
                if 0<=ny<g.shape[0] and 0<=nx<g.shape[1] and g[ny,nx] and not seen[ny,nx]: seen[ny,nx]=1; st.append((ny,nx))
          ys=[c[0] for c in cells]; xs=[c[1] for c in cells]
          y0,y1,x0,x1=min(ys)*B,(max(ys)+1)*B,min(xs)*B,(max(xs)+1)*B
          sub=m[y0:y1,x0:x1]; cnt=sub.sum()
          if cnt<40: continue
          px=im[y0:y1,x0:x1][sub]; l=px.mean(1)
          sl=(slice(y0,y1),slice(x0,x1))
          core=px[l>=np.percentile(l,85)].mean(0)
          hue='amber' if core[0]>core[2]+30 and core[1]>core[2] else ('pink' if core[0]>core[1]+25 and core[2]>core[1]-5 else ('teal' if core[2]>=core[0]+20 else 'other'))
          out.append((sl[1].start,sl[0].start,sl[1].stop-sl[1].start,sl[0].stop-sl[0].start,cnt,h(core),hue))
    out.sort(key=lambda o:-o[4])
    print(f.split('R5_')[1][:-4], '|', '; '.join(f'{o[6]} {o[5]} @({o[0]},{o[1]}) {o[2]}x{o[3]} n{o[4]}' for o in out[:6]))
