from PIL import Image; import numpy as np, sys
h=lambda p:'#%02x%02x%02x'%tuple(int(v) for v in p)
im=np.array(Image.open('../ref_frames/R5_044.78_entity-network.png').convert('RGB')).astype(int); L=im.mean(2)
print('col x=45 y170-185',[(y,h(im[y,45])) for y in range(172,184)])
print('row y=400 x36-44',[(x,h(im[400,x])) for x in range(35,45)])
print('row y=400 x676-684',[(x,h(im[400,x])) for x in range(675,685)])
# box bottom
print('col x=45 y550-565',[(y,h(im[y,45])) for y in range(550,566)])
print('box fill', h(np.median(im[330:340,300:400].reshape(-1,3),0)), 'outside', h(np.median(im[330:340,5:30].reshape(-1,3),0)))
# subheader text
reg=L[185:215,40:500]; ys,xs=np.where(reg>60); print('subheader y',ys.min()+185,ys.max()+185,'x',xs.min()+40,xs.max()+40, 'col', h(im[185:215,40:500].reshape(-1,3)[np.argmax(reg)]))
reg=im[185:215,40:500].reshape(-1,3); l=reg.mean(1); print('subheader p95',h(reg[l>np.percentile(l,99)].mean(0)))
# HUD label color
reg=im[130:152,38:110].reshape(-1,3); l=reg.mean(1); print('HUD label p99',h(reg[l>np.percentile(l,99)].mean(0)))
