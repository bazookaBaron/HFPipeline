from PIL import Image; import numpy as np, glob
h=lambda p:'#%02x%02x%02x'%tuple(int(v) for v in p)
for f in sorted(glob.glob('../ref_frames/R5_*.png')):
  im=np.array(Image.open(f).convert('RGB')).astype(int); L=im.mean(2)
  # text: pixels > 150 in y 930-1060
  reg=L[935:1075,:]; ys,xs=np.where(reg>150)
  if len(ys)==0: print(f[-30:],'no caption'); continue
  ty0,ty1=ys.min()+935,ys.max()+935; tx0,tx1=xs.min(),xs.max()
  # box: scan row at text mid for left edge: from tx0 go left until L drops to bg ~10.7 then find border
  yc=(ty0+ty1)//2
  row=L[yc]; 
  # find box left edge: move left from tx0-3 while row>=12.5 (box fill) 
  x=tx0-3
  while x>0 and abs(row[x]-row[tx0-3])<1.2: x-=1
  bl=x+1
  x=tx1+3
  while x<719 and abs(row[x]-row[tx1+3])<1.2: x+=1
  br=x-1
  col=L[:, (tx0+tx1)//2 if False else bl+6]
  y=yc
  while y>800 and col[y]>11.6: y-=1
  bt=y+1
  y=yc
  while y<1200 and col[y]>11.6: y+=1
  bb=y-1
  fill=h(np.median(im[bt+4:bt+8,bl+6:bl+20].reshape(-1,3),0)); edge=h(im[bt,bl+15]); edge2=h(im[yc,bl])
  txtc=h(im[935:1075][reg>200].reshape(-1,3).mean(0)) if (reg>200).any() else '-'
  print(f[-32:], 'text y',ty0,ty1,'x',tx0,tx1,'| box x',bl,br,'y',bt,bb,'fill',fill,'topedge',edge,'leftedge',edge2,'txt',txtc)
