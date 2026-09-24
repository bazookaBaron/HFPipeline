"""Local visual evidence extraction; no audio, semantic beat inference, or source writes."""
import argparse
import concurrent.futures
import csv
import json
import math
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    'ref1': Path('C:/Users/debna/Downloads/igexport-DdEedoQM6j3.mp4'),
    'ref2': Path('C:/Users/debna/Downloads/igexport-DdG-RuwsDRc.mp4'),
    'ref3': Path('C:/Users/debna/Downloads/igexport-DdSc-I9IqNC.mp4'),
    'ref4': Path('C:/Users/debna/Downloads/igexport-DdT5wzdsQWV.mp4'),
    'ref5': Path('C:/Users/debna/Downloads/igexport-DdIM0QoiZre.mp4'),
    'ours': Path('C:/Repos/HFPipleine/control-panel/data/renders/cs-b9d30fa7964c0cf0.mp4'),
}

def dump(path, data):
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')

def probe(source, out):
    cmd = ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams',
           '-show_format', '-show_frames', '-show_entries',
           'frame=pts,pts_time,best_effort_timestamp,best_effort_timestamp_time,duration_time,pkt_duration_time,key_frame,pict_type:stream:format',
           '-of', 'json', str(source)]
    result = subprocess.run(cmd, capture_output=True, check=True, text=True)
    data = json.loads(result.stdout)
    dump(out / 'ffprobe.json', data)
    frames = data['frames']
    for f in frames:
        f['_time'] = float(f.get('pts_time', f.get('best_effort_timestamp_time')))
    if not frames or any(b['_time'] < a['_time'] for a, b in zip(frames, frames[1:])):
        raise ValueError('Missing frames or non-monotonic presentation timestamps')
    return data, frames

def sheet(items, path, title):
    width = 240
    height = max(round(im.height * width / im.width) for im, _ in items)
    rows = math.ceil(len(items) / 8)
    canvas = Image.new('RGB', (8 * width, 32 + rows * (height + 30)), '#191919')
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 15)
    draw.text((8, 7), title, font=font, fill='white')
    for j, (im, label) in enumerate(items):
        x, y = (j % 8) * width, 32 + (j // 8) * (height + 30)
        thumb = im.resize((width, round(im.height * width / im.width)), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x, y))
        draw.text((x + 3, y + height + 5), label, font=font, fill='white')
    canvas.save(path, quality=92)

def decode(source, w, h, log):
    return subprocess.Popen(['ffmpeg', '-hide_banner', '-v', 'error', '-threads', '2',
        '-noautorotate', '-i', str(source), '-map', '0:v:0', '-an', '-sn', '-dn',
        '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'],
        stdout=subprocess.PIPE, stderr=log)

def read_frame(pipe, size):
    data = bytearray()
    while len(data) < size:
        part = pipe.read(size - len(data))
        if not part:
            break
        data.extend(part)
    if data and len(data) != size:
        raise ValueError('Truncated decoded frame')
    return data

def scene_scores(source, out, frames, threshold):
    # Evaluating scene for every frame, then passing every frame, retains all scores.
    with (out / 'scene-filter.log').open('w', encoding='utf-8') as log:
        subprocess.run(['ffmpeg', '-hide_banner', '-v', 'info', '-threads', '2',
            '-noautorotate', '-copyts', '-i', str(source), '-map', '0:v:0', '-an',
            '-vf', "select='gte(scene,0)',metadata=print:key=lavfi.scene_score",
            '-fps_mode', 'passthrough', '-f', 'null', '-'], stderr=log,
            stdout=subprocess.DEVNULL, check=True)
    scores = []
    current = None
    for line in (out / 'scene-filter.log').read_text(encoding='utf-8').splitlines():
        match = re.search(r'frame:(\d+)\s+pts:\s*(-?\d+)\s+pts_time:([^\s]+)', line)
        if match:
            current = (int(match[1]), float(match[3]))
        match = re.search(r'lavfi.scene_score=([0-9.eE+-]+)', line)
        if match and current is not None:
            scores.append((*current, float(match[1])))
    if len(scores) != len(frames):
        raise ValueError(f'Scene/frame mismatch {len(scores)} != {len(frames)}')
    rows = []
    for i, (index, time, score) in enumerate(scores):
        if index != i or abs(time - frames[i]['_time']) > .0011:
            raise ValueError(f'Scene PTS alignment mismatch at {i}')
        rows.append([i, frames[i]['_time'] * 1000, score, int(score > threshold)])
    with (out / 'scene_scores.csv').open('w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['frame_index', 'pts_ms', 'ffmpeg_scene_score', 'candidate_gt_threshold'])
        writer.writerows(rows)
    dump(out / 'scene_candidates.json', {'threshold': threshold, 'comparison': 'strictly greater',
        'interpretation': 'Cut candidates, not verified cuts or semantic beats',
        'candidates': [dict(zip(['frame_index', 'pts_ms', 'score'], r[:3])) for r in rows if r[3]]})
    return sum(r[3] for r in rows)

def extract(name, threshold, roi):
    source, out = SOURCES[name], ROOT / name
    out.mkdir(parents=True, exist_ok=True)
    for directory in ['dense', 'sheets']:
        (out / directory).mkdir(exist_ok=True)
    data, frames = probe(source, out)
    stream = data['streams'][0]
    w, h = stream['width'], stream['height']
    x0, y0, x1, y1 = [round(v * d) for v, d in zip(roi, [w, h, w, h])]
    origin = frames[0]['_time']
    meta = {'status': 'extracting', 'source': str(source), 'source_size_bytes': source.stat().st_size,
        'width': w, 'height': h, 'duration_seconds': float(data['format']['duration']),
        'stream_duration_seconds': stream.get('duration'), 'avg_frame_rate': stream.get('avg_frame_rate'),
        'time_base': stream['time_base'], 'probed_frame_count': len(frames), 'first_pts_ms': origin * 1000,
        'last_pts_ms': frames[-1]['_time'] * 1000,
        'roi_normalized_xyxy': roi, 'roi_pixels_xyxy': [x0, y0, x1, y1],
        'roi_caveat': 'Operational central content proxy, not a detected content mask; may include captions or omit content.',
        'metrics': 'Every decoded native frame at original raster resolution, RGB24. Consecutive-frame mean absolute RGB channel difference /255 and fraction of pixels whose maximum channel difference exceeds 16/255. First frame differences undefined.',
        'timestamps': 'ffprobe per-frame pts_time; best_effort_timestamp_time only if pts_time absent. Index is zero-based display order. elapsed_ms subtracts first PTS.',
        'dense_sampling': '8Hz grid from first PTS; nearest native frame to each target, no interpolation; manifest retains target and actual PTS.',
        'scene_threshold': threshold, 'scene_algorithm': 'FFmpeg select scene, all scores retained at native resolution',
        'thumbnail_width': 240, 'sheet_grid': [8, 6], 'hue_analysis': 'not performed',
        'audio_analysis': 'not performed', 'rotation': 'autorotate disabled; stored raster orientation'}
    dump(out / 'metadata.json', meta)
    duration = float(stream.get('duration', data['format']['duration']))
    times = np.array([f['_time'] for f in frames])
    targets = np.arange(0, duration, 1 / 8) + origin
    chosen = {}
    for target in targets:
        index = int(np.searchsorted(times, target))
        index = min(index, len(times) - 1)
        if index and abs(times[index-1] - target) <= abs(times[index] - target):
            index -= 1
        chosen.setdefault(index, []).append(float(target))
    previous, pending, dense_count, sheets, count = None, [], 0, 0, 0
    with (out / 'decode.log').open('w') as log, (out / 'native_metrics.csv').open('w', newline='') as mf, (out / 'dense_manifest.csv').open('w', newline='') as df:
        metrics, dense = csv.writer(mf), csv.writer(df)
        metrics.writerow(['frame_index', 'pts_ms', 'elapsed_ms', 'pts_raw', 'pts_source', 'full_mae_0_1', 'full_changed_fraction_gt16', 'roi_mae_0_1', 'roi_changed_fraction_gt16'])
        dense.writerow(['sample_index', 'target_pts_ms', 'frame_index', 'pts_ms', 'elapsed_ms', 'image'])
        process = decode(source, w, h, log)
        try:
            while True:
                raw = read_frame(process.stdout, w * h * 3)
                if not raw:
                    break
                if count >= len(frames):
                    raise ValueError('More decoded frames than probed frames')
                arr = np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3)
                f = frames[count]
                values = ['', '', '', '']
                if previous is not None:
                    diff = np.abs(arr.astype(np.int16) - previous)
                    crop = diff[y0:y1, x0:x1]
                    values = [float(diff.mean()/255), float((diff.max(axis=2)>16).mean()),
                              float(crop.mean()/255), float((crop.max(axis=2)>16).mean())]
                metrics.writerow([count, f['_time']*1000, (f['_time']-origin)*1000,
                    f.get('pts', f.get('best_effort_timestamp')), 'pts' if 'pts_time' in f else 'best_effort', *values])
                previous = arr.astype(np.int16)
                if count in chosen:
                    im = Image.fromarray(arr).resize((540, round(h*540/w)), Image.Resampling.LANCZOS)
                    for target in chosen[count]:
                        filename = f'dense/{dense_count:06d}_f{count:06d}_{f["_time"]*1000:010.3f}ms.jpg'
                        im.save(out / filename, quality=93)
                        dense.writerow([dense_count, target*1000, count, f['_time']*1000, (f['_time']-origin)*1000, filename])
                        pending.append((im, f'{f["_time"]:07.3f}s f{count}'))
                        dense_count += 1
                        if len(pending) == 48:
                            path = out / 'sheets' / f'sheet_{sheets:04d}.jpg'
                            sheet(pending, path, f'{name} | actual PTS seconds | native frame index')
                            if sheets == 0:
                                print(f'FIRST_READY {name} {path}', flush=True)
                            sheets += 1
                            pending = []
                            mf.flush(); df.flush()
                count += 1
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.terminate()
            code = process.wait()
        if code != 0 or count != len(frames):
            raise ValueError(f'Decode incomplete: exit={code}, decoded={count}, expected={len(frames)}')
    if pending:
        sheet(pending, out / 'sheets' / f'sheet_{sheets:04d}.jpg', f'{name} | actual PTS seconds | native frame index')
        sheets += 1
    candidates = scene_scores(source, out, frames, threshold)
    meta.update(status='complete', decoded_frame_count=count, dense_image_count=dense_count,
                contact_sheet_count=sheets, scene_candidate_count=candidates)
    dump(out / 'metadata.json', meta)
    print(f'DONE {name} duration={meta["duration_seconds"]} native={count} dense={dense_count} sheets={sheets} candidates={candidates}', flush=True)
    return meta

def zoom(name, start, end):
    out = ROOT / name
    metadata = json.loads((out / 'metadata.json').read_text())
    data = json.loads((out / 'ffprobe.json').read_text())
    frames = data['frames']
    dest = out / 'zoom' / f'{start:.3f}-{end:.3f}'
    dest.mkdir(parents=True, exist_ok=True)
    if any(dest.iterdir()):
        raise ValueError(f'Zoom output already exists: {dest}')
    w, h = metadata['width'], metadata['height']
    pending, pages, selected = [], 0, 0
    with (dest / 'decode.log').open('w') as log, (dest / 'manifest.csv').open('w', newline='') as mf:
        writer = csv.writer(mf); writer.writerow(['frame_index', 'pts_ms', 'image'])
        process = decode(SOURCES[name], w, h, log)
        try:
            for i, f in enumerate(frames):
                time = float(f.get('pts_time', f.get('best_effort_timestamp_time')))
                if time >= end:
                    break
                raw = read_frame(process.stdout, w*h*3)
                if not raw:
                    raise ValueError('Early EOF during zoom')
                if time < start:
                    continue
                im = Image.frombytes('RGB', (w, h), bytes(raw))
                filename = f'f{i:06d}_{time*1000:010.3f}ms.jpg'
                im.save(dest / filename, quality=95)
                writer.writerow([i, time*1000, filename])
                pending.append((im.resize((540, round(h*540/w))), f'{time:07.3f}s f{i}'))
                selected += 1
                if len(pending) == 48:
                    sheet(pending, dest / f'sheet_{pages:04d}.jpg', f'{name} | EVERY native frame | PTS seconds')
                    pending = []; pages += 1
        finally:
            process.stdout.close()
            if process.poll() is None:
                process.terminate()
            process.wait()
    if pending:
        sheet(pending, dest / f'sheet_{pages:04d}.jpg', f'{name} | EVERY native frame | PTS seconds')
    if not selected:
        raise ValueError('No native frames within interval')
    print(f'ZOOM_READY frames={selected} {dest}', flush=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', nargs='+', choices=list(SOURCES), default=list(SOURCES))
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--threshold', type=float, default=.15)
    parser.add_argument('--roi', nargs=4, type=float, default=[.05, .15, .95, .85], metavar=('X0','Y0','X1','Y1'))
    parser.add_argument('--zoom', choices=list(SOURCES))
    parser.add_argument('--start', type=float, default=0)
    parser.add_argument('--end', type=float, default=1)
    args = parser.parse_args()
    if args.zoom:
        if args.end <= args.start:
            parser.error('--end must exceed --start (absolute PTS seconds)')
        zoom(args.zoom, args.start, args.end)
        return
    x0,y0,x1,y1 = args.roi
    if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        parser.error('ROI must be normalized xyxy')
    for name in args.sources:
        if (ROOT / name / 'metadata.json').exists():
            parser.error(f'{name}/metadata.json exists; refusing to overwrite extraction')
    with concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(extract, n, args.threshold, args.roi): n for n in args.sources}
        for future in concurrent.futures.as_completed(futures):
            future.result()

if __name__ == '__main__':
    main()
