"""Per-turn analysis of voice2.wav: pitch (f0 median, range st, end-rise), wpm, gap, + Earshot gender/tone (weak hint only)."""
import json, sys, subprocess, numpy as np
from pathlib import Path
D=Path(__file__).parent; wav=sys.argv[1]; words=json.load(open(sys.argv[2])); out=sys.argv[3]
TURNS=[("L","Grandpa, where do my photos go when I upload them?"),("W","To a building full of computers."),("L","A building? I thought they went to the cloud."),("W","The cloud is a building."),("L","Not a real cloud?"),("W","No. Just a huge room of computers, with a lot of fans to keep them cool."),("L","Whose computers?"),("W","A company's. Google, Apple, Amazon. You just rent a little space."),("L","So my photos live in someone else's computer?"),("W","Yes. And they keep spare copies. If one computer breaks, your photos are still safe."),("L","Like a spare key?"),("W","Exactly like a spare key."),("L","So that's why I can open them on any phone."),("W","Right. Your phone doesn't keep the photo. It just shows it to you."),("L","So the cloud is just... someone else's computer."),("W","Now you've got it."),("L","Does the building know I took forty selfies?"),("W","Forty-one.")]
cnt=[len(t.replace("-"," ").split()) for _,t in TURNS]
# ASR merged "Eleven. Okay." -> "11, okay." (2 tokens: 11, okay) ; "Forty." -> "40." : counts match by word count
segs=[];i=0
for (sp,t),c in zip(TURNS,cnt):
    ws=words[i:i+c]; i+=c
    segs.append(dict(speaker=sp,text=t,start=ws[0][0],end=ws[-1][1]))
from earshot import api
import librosa
y,sr=librosa.load(wav,sr=16000)
TONE=["a person speaking excitedly","a person speaking in a flat deadpan monotone","a worried anxious person speaking","a calm narrator speaking","a cheerful happy person speaking","a confused person asking a question"]
G=["a man speaking","a woman speaking"]
res=[]
for k,s in enumerate(segs):
    a,b=s["start"],max(s["end"],s["start"]+0.6)
    seg=y[int(a*sr):int(b*sr)]
    f0,vf,_=librosa.pyin(seg,fmin=70,fmax=400,sr=sr)
    f=f0[~np.isnan(f0)]
    r=dict(turn=k+1,**s,dur=round(s["end"]-s["start"],2),wpm=round(len(s["text"].split())/max(s["end"]-s["start"],.3)*60))
    if len(f)>5:
        st=12*np.log2(f/np.median(f)); r.update(f0_med=round(float(np.median(f))),range_st=round(float(np.percentile(st,95)-np.percentile(st,5)),1),
            end_vs_start_st=round(float(np.median(st[-max(3,len(st)//4):])-np.median(st[:max(3,len(st)//4)])),1))
    try:
        m=api.match(wav,TONE,start=a,end=b); r["tone"]=sorted([(x["query"],round(x["p_vs_alts"],2)) for x in m["results"]],key=lambda t:-t[1])[:2]
        g=api.match(wav,G,start=a,end=b); r["gender"]=[(x["query"],round(x["p_vs_alts"],2)) for x in g["results"]][:2]
    except Exception as e: r["earshot_err"]=repr(e)[:80]
    res.append(r); print(r,flush=True)
json.dump(res,open(out,"w"),indent=1)
