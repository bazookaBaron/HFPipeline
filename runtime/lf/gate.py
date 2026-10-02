# usage: python gate.py chNN [--reuse]  -> snapshots every 0.5 s, 2 fps slideshow, runtime/measure.py density
import sys, os, re, subprocess, glob
ch = sys.argv[1]; d = os.path.join(os.path.dirname(os.path.abspath(__file__)), ch); os.chdir(d)
D = float(re.search(r'data-duration="([0-9.]+)"', open("index.html").read()).group(1))
if "--reuse" not in sys.argv:
    import shutil; shutil.rmtree("gate", ignore_errors=True)
    at = ",".join(str(round(i * 0.5, 2)) for i in range(int(D / 0.5)))
    subprocess.run(f'npx --yes hyperframes@0.8.46 snapshot --no-end --at {at} -o gate', shell=True, capture_output=True)
fr = sorted(glob.glob("gate/frame-*.png"), key=lambda p: int(re.search(r"frame-(\d+)", p).group(1)))
open("gate/list.txt", "w").write("".join(f"file '{os.path.basename(p)}'\nduration 0.5\n" for p in fr))
subprocess.run("ffmpeg -v error -y -f concat -safe 0 -i gate/list.txt -vf fps=2 -c:v libx264 -pix_fmt yuv420p -crf 12 gate.mp4", shell=True)
print(len(fr), "frames");
subprocess.run("ffmpeg -v error -y -i gate.mp4 -vf crop=1360:840:50:120 gate-stage.mp4", shell=True)
print("full  :", subprocess.run("python ../../../../runtime/measure.py gate.mp4 --fps 2 --size 1920x1080 --zone 120-960", shell=True, capture_output=True, text=True).stdout.strip())
print("stage :", subprocess.run("python ../../../../runtime/measure.py gate-stage.mp4 --fps 2 --size 1360x840 --zone 0-840", shell=True, capture_output=True, text=True).stdout.strip())
