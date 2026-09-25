from m_util import *
import sys
a=load('../ref_frames/R2_018.26_topology-carrier.png')
def prow(y,x0,x1): print('row',y,x0,[hx(a[y,x]) for x in range(x0,x1)])
def pcol(x,y0,y1): print('col',x,y0,[hx(a[y,x]) for y in range(y0,y1)])
# HUD edges
pcol(360,152,210); prow(180,34,48); prow(180,672,686)
# HUD corner radius: for rows near top, where does border start
for y in range(155,166): 
  xs=[x for x in range(30,80) if a[y,x].sum()>40]; print('hudTL',y,xs[:1])
# BLUE card
pcol(300,625,680); prow(750,214,228); prow(750,436,450)
for y in range(630,645):
  xs=[x for x in range(214,260) if a[y,x].sum()>60]; print('cardTL',y,xs[:1])
pcol(300,860,872)
# green card
prow(750,452,466); prow(750,672,686)
# router pill
pcol(500,515,570); prow(541,216,240)
