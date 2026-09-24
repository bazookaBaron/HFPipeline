"""Build dense review sheets independently of the slower native-frame metrics pass."""
import argparse
import csv
import json
import subprocess
import numpy as np
from PIL import Image
from extract_evidence import ROOT, SOURCES, probe, sheet, read_frame, dump

def main(name):
    out = ROOT / 'fast-review' / name
    out.mkdir(parents=True, exist_ok=True)
    if (out / 'complete.json').exists():
        print('ALREADY_COMPLETE', name, flush=True)
        return
    (out / 'dense').mkdir(exist_ok=True)
    (out / 'sheets').mkdir(exist_ok=True)
    data, frames = probe(SOURCES[name], out)
    stream = data['streams'][0]
    times = np.array([f['_time'] for f in frames])
    targets = np.arange(times[0], times[-1] + 1e-7, .125)
    indices = []
    for t in targets:
        i = min(int(np.searchsorted(times, t)), len(times)-1)
        if i and abs(times[i-1]-t) <= abs(times[i]-t):
            i -= 1
        if not indices or i != indices[-1]:
            indices.append(i)
    expr = '+'.join(f'eq(n,{i})' for i in indices)
    w, h = 540, round(stream['height'] * 540 / stream['width'])
    pending, pages = [], 0
    with (out / 'decode.log').open('w') as log, (out / 'dense_manifest.csv').open('w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['sample_index','frame_index','pts_ms','image'])
        p = subprocess.Popen(['ffmpeg','-hide_banner','-v','error','-threads','2',
            '-noautorotate','-i',str(SOURCES[name]),'-map','0:v:0','-an',
            '-vf',f"select='{expr}',scale={w}:{h}",'-fps_mode','passthrough',
            '-pix_fmt','rgb24','-f','rawvideo','pipe:1'],stdout=subprocess.PIPE,stderr=log)
        try:
            for j, i in enumerate(indices):
                raw = read_frame(p.stdout, w*h*3)
                if not raw:
                    raise RuntimeError('Unexpected EOF')
                im = Image.frombytes('RGB',(w,h),bytes(raw))
                filename = f'dense/{j:06d}_f{i:06d}.jpg'
                im.save(out / filename, quality=92)
                writer.writerow([j,i,times[i]*1000,filename])
                pending.append((im,f'{times[i]:07.3f}s f{i}'))
                if len(pending)==48:
                    sheet(pending,out/'sheets'/f'sheet_{pages:04d}.jpg',f'{name} | nearest 8Hz source frames | actual PTS')
                    pending=[]; pages+=1; f.flush()
            if read_frame(p.stdout,w*h*3):
                raise RuntimeError('Unexpected extra output frame')
            p.stdout.close()
            if p.wait()!=0:
                raise RuntimeError('FFmpeg failure; see decode.log')
        finally:
            if p.poll() is None:
                p.terminate(); p.wait()
    if pending:
        sheet(pending,out/'sheets'/f'sheet_{pages:04d}.jpg',f'{name} | nearest 8Hz source frames | actual PTS')
        pages+=1
    dump(out/'complete.json',{'source':str(SOURCES[name]),'native_frames':len(frames),
        'review_frames':len(indices),'sheets':pages,'duration_seconds':float(stream['duration']),
        'resolution':[stream['width'],stream['height']],'fps':stream['avg_frame_rate'],
        'sampling':'8Hz nearest native presentation timestamp; no interpolation',
        'decoded_selection_count_verified':True})
    print('COMPLETE',name,len(indices),pages,flush=True)

if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('sources',nargs='+',choices=list(SOURCES))
    for name in ap.parse_args().sources:
        main(name)
