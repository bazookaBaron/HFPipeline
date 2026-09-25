from m_tb import *
P='../ref_frames/R2_018.26_topology-carrier.png'
for args in [(50,170,186,192,'hud host text'),(186,168,262,194,'hud BLUE pill'),(200,175,250,188,'hud pill text',60),(262,170,320,192,'hud v1.4.2'),(570,170,616,192,'hud 0.4%'),(618,172,670,190,'hud ERRORS'),
 (225,375,675,412,'users row'),(233,375,260,412,'user icon1'),(280,375,310,412,'user icon2'),(420,415,480,432,'USERS label',60),
 (226,524,264,558,'router icon'),(268,532,372,552,'listener :443'),(374,530,444,554,'forward chip'),(448,532,545,552,'blue-tg 100%'),(500,532,545,552,'100% blue'),(552,532,640,552,'green-tg 0%'),
 (310,562,352,636,'lever'),(425,586,472,610,'0% pill'),
 (230,644,280,664,'BLUE header'),(380,642,436,664,'LIVE pill'),(230,682,290,700,'blue-tg mono'),(370,678,436,705,'v1.4.2 pill'),
 (230,708,258,733,'instance icon'),(260,710,345,730,'i-0a3f8c21'),(385,712,440,728,'HEALTHY'),(340,712,360,728,'dot'),
 (230,822,280,850,'100%'),(285,832,360,848,'OF TRAFFIC'),(466,644,530,664,'GREEN header'),(466,806,590,822,'IDLE·REGISTERED'),(640,712,676,728,'IDLE')]:
    thr=args[5] if len(args)>5 else 90
    tb(P,*args[:4],thr=thr,name=args[4])
