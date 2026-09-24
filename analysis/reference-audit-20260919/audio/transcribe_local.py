"""Offline ASR of the six final MP4s. Writes only into this audit audio directory."""
import os
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
import concurrent.futures
import hashlib
import importlib.metadata
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MODEL = Path('C:/Users/debna/.cache/huggingface/hub/models--Systran--faster-whisper-large-v3/snapshots/edaa852ec7e145841d8ffdb056a99866b5f0a478')
SOURCES = {
    'ref1': 'C:/Users/debna/Downloads/igexport-DdEedoQM6j3.mp4',
    'ref2': 'C:/Users/debna/Downloads/igexport-DdG-RuwsDRc.mp4',
    'ref3': 'C:/Users/debna/Downloads/igexport-DdSc-I9IqNC.mp4',
    'ref4': 'C:/Users/debna/Downloads/igexport-DdT5wzdsQWV.mp4',
    'ref5': 'C:/Users/debna/Downloads/igexport-DdIM0QoiZre.mp4',
    'ours': 'C:/Repos/HFPipleine/control-panel/data/renders/cs-b9d30fa7964c0cf0.mp4',
}
SETTINGS = dict(language='en', task='transcribe', beam_size=5, temperature=0,
                word_timestamps=True, vad_filter=True, condition_on_previous_text=True)

def dump(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False), encoding='utf-8')

def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def prepare(item):
    sid, source = item
    out = ROOT / sid
    out.mkdir(exist_ok=True)
    probe = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', source], text=True))
    dump(out / 'source.ffprobe.json', probe)
    audio = next(s for s in probe['streams'] if s['codec_type'] == 'audio')
    # Reject an unhandled origin rather than silently introducing sync error.
    assert float(audio['start_time']) == float(probe['format']['start_time']) == 0
    wav = out / 'audio.16k.mono.wav'
    command = ['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-i', source,
               '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', str(wav)]
    subprocess.run(command, check=True, capture_output=True)
    return sid, dict(source_path=source, source_sha256=sha(source),
                     source_size_bytes=Path(source).stat().st_size,
                     source_duration_seconds=float(probe['format']['duration']),
                     audio_duration_seconds=float(audio['duration']),
                     extracted_audio_path=str(wav), extracted_audio_sha256=sha(wav),
                     extraction_command=command, timeline_origin_seconds=0.0)

def sentences_from_words(words):
    sentences, pending = [], []
    for word in words:
        pending.append(word)
        if re.search(r'[.!?][\"\u201d\u2019\)]*$', word['word']):
            sentences.append(pending)
            pending = []
    if pending:
        sentences.append(pending)
    return [dict(id=i, start=group[0]['start'], end=group[-1]['end'],
                 first_word_id=group[0]['id'], last_word_id=group[-1]['id'],
                 word_count=len(group), text=' '.join(w['word'] for w in group),
                 boundary='asr_punctuation' if re.search(r'[.!?][\"\u201d\u2019\)]*$', group[-1]['word']) else 'end_of_file_fragment')
            for i, group in enumerate(sentences)]

def main():
    started = time.time()
    print('Preparing six final-source audio tracks locally', flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        prepared = dict(pool.map(prepare, SOURCES.items()))
    versions = {p: importlib.metadata.version(p) for p in ['faster-whisper', 'ctranslate2', 'whisperx']}
    model_hashes = {p.name: sha(p) for p in MODEL.iterdir() if p.is_file() and p.name in
                    ['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.json']}
    print('Loading cached large-v3 on CUDA, int8_float16', flush=True)
    from faster_whisper import WhisperModel
    model = WhisperModel(str(MODEL), device='cuda', compute_type='int8_float16', local_files_only=True)
    summary = []
    for sid, source in prepared.items():
        out = ROOT / sid
        print(f'{sid}: ASR started', flush=True)
        segments, info = model.transcribe(source['extracted_audio_path'], **SETTINGS)
        raw, words = [], []
        for segment in segments:
            raw.append(segment._asdict())
            raw[-1]['words'] = [w._asdict() for w in segment.words or []]
            for w in segment.words or []:
                words.append(dict(id=len(words), segment_id=segment.id, word=w.word.strip(),
                                  start=w.start, end=w.end, probability=w.probability))
            print(f'{sid}: {segment.end:.2f}s / {source["source_duration_seconds"]:.2f}s', flush=True)
        assert words, f'{sid}: no words'
        sentences = sentences_from_words(words)
        invalid = [w['id'] for w in words if not 0 <= w['start'] <= w['end'] <= source['source_duration_seconds'] + .1]
        regressions = [w['id'] for prev, w in zip(words, words[1:]) if w['start'] < prev['start']]
        zero = [w['id'] for w in words if w['start'] == w['end']]
        low = [w['id'] for w in words if w['probability'] < .5]
        overlaps = [w['id'] for prev, w in zip(words, words[1:]) if w['start'] < prev['end']]
        assert not invalid and not regressions, f'{sid}: invalid timestamp ordering/bounds'
        provenance = dict(schema_version=1, source_id=sid, **source,
            generated_at_utc=datetime.now(timezone.utc).isoformat(),
            method='real_local_asr_on_final_mp4_audio', engine='faster-whisper', versions=versions,
            python_executable=sys.executable, model='Systran/faster-whisper-large-v3',
            model_snapshot=str(MODEL), model_file_sha256=model_hashes,
            device='cuda', compute_type='int8_float16', settings=SETTINGS,
            offline=True, external_provider=None, original_alignment_reused=False,
            post_render_mapping='Not required: direct transcription of delivered MP4; timestamps already in final media seconds.',
            word_timestamp_method='Faster-Whisper cross-attention/DTW word timestamps; no text-derived duration estimates.',
            sentence_method='Split after ASR word punctuation . ! ?; retain trailing fragment. ASR punctuation is uncertain; segments are not treated as sentences.',
            timing_uncertainty='Model estimated, not manually certified. Stored decimal precision is not demonstrated boundary accuracy. VAD timestamps restored to full audio timeline by Faster-Whisper.',
            listening_review='not_performed', sfx_per_beat_ratio=None,
            sfx_status='unavailable: mixed speech/music transients have not been listened to/classified as SFX',
            word_count=len(words), sentence_count=len(sentences),
            quality=dict(invalid_word_ids=invalid, regressing_word_ids=regressions,
                         zero_duration_word_ids=zero, probability_below_0_5_word_ids=low,
                         overlapping_word_ids=overlaps),
            transcription_info=dict(language=info.language, language_probability=info.language_probability,
                                    duration=info.duration, duration_after_vad=info.duration_after_vad))
        dump(out / 'asr.raw.json', dict(segments=raw))
        dump(out / 'words.json', dict(source_id=sid, time_unit='seconds', time_basis='final_mp4', provenance='provenance.json', words=words))
        dump(out / 'sentences.json', dict(source_id=sid, time_unit='seconds', time_basis='final_mp4', provenance='provenance.json', sentences=sentences))
        dump(out / 'provenance.json', provenance)
        (out / 'transcript.txt').write_text('\n'.join(f'[{s["start"]:.2f}–{s["end"]:.2f}] {s["text"]}' for s in sentences) + '\n', encoding='utf-8')
        summary.append(dict(source_id=sid, duration_seconds=source['source_duration_seconds'],
                            word_count=len(words), sentence_count=len(sentences),
                            first_word_start=words[0]['start'], last_word_end=words[-1]['end'],
                            zero_duration_words=len(zero), low_probability_words=len(low),
                            provenance=str(out / 'provenance.json')))
        dump(ROOT / 'summary.json', dict(status='running', completed=summary))
        print(f'{sid}: COMPLETE {len(words)} words, {len(sentences)} sentences', flush=True)
    dump(ROOT / 'summary.json', dict(status='complete', elapsed_seconds=time.time()-started, completed=summary))
    print('ALL SIX COMPLETE', flush=True)

if __name__ == '__main__':
    main()
