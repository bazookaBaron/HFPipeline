# Cut the voice per chapter window, mux it onto each chapter video, then concat. Usage: python stitch.py
import json, subprocess, os
W=json.load(open('words.json')); C=json.load(open('chapters.json'))
firsts=[c['first_line'] for c in C]+[10**9]
def run(a): subprocess.run(a,check=True)
parts=[]
for i,c in enumerate(C):
    ws=[w for w in W if firsts[i]<=w['line']<firsts[i+1]]
    pv=[w for w in W if w['line']<firsts[i]]; s=max(0,ws[0]['s']-(min(3.0,ws[0]['s']-pv[-1]['e']-0.27) if pv else 0.25)); v=f'ch{i:02d}.mp4'  # LEAD: start inside the chapter pause (= build.js)
    d=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',v]))
    o=f'_st{i:02d}.mp4'
    run(['ffmpeg','-v','error','-y','-i',v,'-ss',f'{s:.3f}','-t',f'{d:.3f}','-i','mix.wav' if os.path.exists('mix.wav') else 'vo/voice.wav',
         '-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-af','apad','-t',f'{d:.3f}',o])
    print(i,c['title'],f'start {s:.2f} dur {d:.2f} words_end {ws[-1]["e"]-s:.2f}'); parts.append(o)
open('_list.txt','w').write(''.join(f"file '{p}'\n" for p in parts))
run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i','_list.txt','-c','copy','longform-rough.mp4'])
print('done')
