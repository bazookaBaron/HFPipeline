from mlib import *
import colorsys
def accents(t,x0,y0,x1,y1,name):
    im=load(t); reg=im[y0:y1,x0:x1].reshape(-1,3)
    mx=reg.max(1); mn=reg.min(1); sat=(mx-mn)/np.maximum(mx,1)
    sel=reg[(sat>0.35)&(mx>60)]
    if len(sel)==0: print(name,'none'); return
    # brightest 10% of saturated = stroke/text core; median = typical
    l=sel.mean(1); core=sel[l>=np.percentile(l,90)]
    print(f'{name:28s} n={len(sel):5d} median {h(np.median(sel,0))} core {h(core.mean(0))}')
def fill(t,x,y,name,r=2):
    im=load(t); print(f'{name:28s} fill {h(np.median(im[y-r:y+r+1,x-r:x+r+1].reshape(-1,3),0))}')
accents('044.78',85,336,660,540,'pink nodes+links 44.78')
accents('044.78',400,370,430,395,'pink link seg')
fill('044.78',100,345,'pink tile fill')
accents('001.88',60,120,680,420,'teal DB nodes 1.88')
fill('001.88',70,165,'teal DB tile fill')
accents('065.68',60,280,680,370,'teal FOUNDRY bar')
fill('065.68',120,340,'FOUNDRY bar fill')
accents('055.75',540,600,700,640,'teal pill SAME PROBLEM')
fill('055.75',560,625,'pill fill')
accents('128.38',60,220,660,410,'amber prompt card')
fill('128.38',100,340,'amber card fill')
accents('156.88',590,560,720,700,'amber decision card')
fill('156.88',600,620,'decision fill')
accents('087.41',50,540,660,570,'amber 847 row')
fill('087.41',400,555,'847 row fill')
accents('143.05',520,570,700,690,'teal pipeline tiles')
fill('143.05',540,620,'pipeline tile fill')
accents('141.15',1,1480//2,1,1,'x') if False else None
accents('141.15',300,480,660,720,'access ring')
fill('141.15',360,620,'ring interior')
accents('014.63',100,160,700,400,'timeline marker 14.63')
accents('116.25',60,480,680,560,'timeline 116')
accents('111.65',200,240,680,380,'amber question 111')
accents('072.85',1020//2,560,700,760,'order rows amber')
fill('072.85',560,600,'amber row fill')
accents('136.75',520,230,720,460,'stack layers')
fill('136.75',600,262,'AIP layer fill'); fill('136.75',600,436,'connected layer fill')
accents('138.35',40,520,680,700,'ranked list')
fill('138.35',80,550,'PLANT A fill')
accents('078.25',60,380,700,440,'two col pills')
accents('113.25',400,200,700,460,'LM chip + teal base')
fill('113.25',620,380,'teal base fill'); fill('113.25',470,260,'LM chip fill')
