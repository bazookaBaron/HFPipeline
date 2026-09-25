from grab import *
ts=[0.5,6.98,13.23,39.68,43.33,50.73,62.08,76.48,98.58,120.48,153.48,176.08]
for t in ts:
    a=grab(t)
    reg=a[900:1080]
    wm=(reg.min(2)>200)
    # border: longest horizontal white run rows
    rowsum=wm.sum(1); top=np.where(rowsum>150)[0]
    if len(top)==0: print(t,"no box"); continue
    y0=top.min()+900; y1=top.max()+900
    colsum=wm[y0-900+10:y1-900-10].sum(0); 
    # vertical border columns: columns white across most of box height
    vc=np.where(wm[y0-900:y1-900+1].sum(0)>(y1-y0)*0.8)[0]
    x0,x1=vc.min(),vc.max()
    inner=reg[y0-900+4:y1-900-4, x0+4:x1-4]
    tm=(inner.max(2)>120)
    xs=np.where(tm.any(0))[0]; ys=np.where(tm.any(1))[0]
    # grey vs white vs cyan counts
    px=inner.reshape(-1,3); br=px.max(1)>150
    cy=(px[:,2]>180)&(px[:,0]<150); wh=(px.min(1)>200); gr=(px.max(1)>100)&(px.max(1)<200)&(np.abs(px[:,0]-px[:,2])<25)
    print(f"t={t:7.2f} box x{x0}-{x1} (w{x1-x0+1}) y{y0}-{y1} (h{y1-y0+1}) cx={(x0+x1)/2:.1f} cy={(y0+y1)/2:.1f} | text x{xs.min()+x0+4}-{xs.max()+x0+4} y{ys.min()+y0+4}-{ys.max()+y0+4} padL={xs.min()+4} padR={x1-(xs.max()+x0+4)} | cyan{cy.sum()} white{wh.sum()} grey{gr.sum()}")
