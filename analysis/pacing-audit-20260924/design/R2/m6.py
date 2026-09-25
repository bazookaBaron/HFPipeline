from m_util import *
def acc(p,x0,y0,x1,y1,name):
    a=load(p); r=a[int(y0/1.5):int(y1/1.5),int(x0/1.5):int(x1/1.5)].reshape(-1,3)
    sat=r.max(1)-r.min(1); v=r.max(1); sc=sat+v
    top=r[sc>=np.percentile(sc,97)]
    u,c=np.unique(r,axis=0,return_counts=True)
    print(f'{name:28s} accent {hx(np.median(top,0))}  modal {hx(u[c.argmax()])}')
R='../ref_frames/R2_018.26_topology-carrier.png'
L=[(R,350,970,410,988,'card BLUE header text'),(R,705,970,785,988,'card GREEN header text'),(R,345,1062,387,1100,'orange instance icon'),
(R,339,786,396,837,'purple router icon'),(R,574,1028,636,1046,'v1.4.2 pill'),(R,596,972,630,988,'LIVE pill'),(R,700,1215,870,1232,'IDLE REGISTERED amber'),
(R,519,1075,530,1087,'healthy dot'),(R,330,950,664,1300,'blue card'),(R,684,950,1016,1300,'green card'),(R,60,237,1020,305,'HUD'),(R,306,262,368,282,'HUD BLUE pill'),
('fr_143.900.png',290,360,795,455,'ONE LIVE blue'),('fr_143.900.png',223,505,865,600,'ONE READY green'),('fr_071.780.png',850,340,1020,440,'18% red'),
('fr_032.600.png',350,380,700,410,'500 POST red'),('fr_032.600.png',330,334,1020,451,'500 banner panel'),('fr_033.800.png',345,570,1000,620,'users red'),
('fr_002.800.png',700,453,870,488,'Deploy v2.0.0 amber pill'),('fr_118.200.png',600,412,770,452,'ALL AT ONCE pill'),('fr_050.500.png',900,300,1020,340,'TESTS FAILED pill?'),
('fr_086.000.png',62,545,1020,1300,'DB panel purple'),('fr_100.600.png',350,380,830,410,'BACKWARD COMPATIBLE'),('fr_109.800.png',680,372,835,413,'counter purple'),
('fr_109.800.png',150,556,1020,640,'tabs'),('fr_103.800.png',170,480,775,525,'tab bar dim'),('fr_005.130.png',400,560,960,700,'503 red'),
('fr_132.800.png',300,150,700,500,'spotlight cone'),('fr_140.500.png',540,500,1020,1110,'green card red flash'),('fr_071.780.png',330,470,1020,760,'chart panel'),
('fr_000.750.png',20,280,330,800,'title BLUE card'),('fr_000.750.png',350,280,660,800,'title GREEN card'),('fr_041.600.png',330,480,1020,760,'test console'),('fr_041.600.png',900,560,1020,760,'bypass line/200 amber'),
('fr_073.600.png',330,330,550,375,'ROLLBACK red pill'),('fr_064.100.png',330,340,750,444,'downtime box'),('fr_112.800.png',100,520,380,560,'+7 DAYS pill'),('fr_135.000.png',480,530,600,560,'IDENTICAL pill')]
for l in L: acc(*l)
