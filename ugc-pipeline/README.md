# UGC pipeline

30 AI-presenter reels (9:16, 40 s) from a brief, generated with MiniMax H3 on one rented Vast.ai GPU, under a hard money cap, finished on your Mac.

**Use:** experimental, non-commercial, no training on the outputs, nothing shown in the US, EU, UK or South Korea (H3 licence). Every frame carries an
AI label, and scripts that claim a personal experience are refused.

Run everything from this folder. In the commands below, `py` means `uv run --no-project --python 3.12 python`.

## What you provide

| What | Where |
|---|---|
| Brief: topic, claims with sources, presenter (adult, fictional), call to action | `projects/<name>/brief.json` |
| Character sheet: outfit front and back on the left (no heads), one face close-up on the right | `projects/<name>/cast/sheet.png` |
| Voice: 5-10 s, synthetic or recorded with consent | `projects/<name>/voice/ref.wav` |
| B-roll, about 10 s per reel (optional; a text card fills in) | `projects/<name>/broll/`, named in `reels.jsonl` |
| Vast.ai key | `.env` (copy `.env.example`); never in chat |
| SSH key registered on Vast.ai, about $10 credit | your Vast account |

## Steps

```
py -m ugc init myreels
py -m ugc template myreels > ask.txt        # give this to Claude; save its answer as reels.txt
py -m ugc import myreels reels.txt          # lists every problem to fix
py -m ugc offers                            # live machines that pass every rule; no key needed
py -m ugc pilot myreels --interruptible     # RENTS. Shows the price, waits for you to type: rent
py -m ugc approve-pilot myreels             # after you have watched projects/myreels/pilot/
py -m ugc batch myreels --interruptible     # RENTS. Best quality that fits the cap; rerun it if the host takes the machine
py -m ugc select myreels
py -m ugc edit myreels                      # finished reels in projects/myreels/final/
py -m ugc status myreels                    # what exists, what is missing, money spent
py -m ugc reap myreels                      # if anything went wrong: destroys our machines only
```

Keep the Mac open and plugged in during a batch (1.5 MP takes about 20 hours). Sleep is blocked, but a closed lid can still end the run.

## Money safety

- One cap (`budget.cap_usd` in `config.toml`), counted from `ledger.jsonl`, pilot included. Code never raises it.
- Renting needs you to type `rent` in a terminal. There is no flag to skip that.
- The machine is destroyed on every exit, then checked to be gone; failure to confirm is loud and names the machine.
- The machine also destroys itself when idle, at a wall-clock limit, or if setup fails. It cannot do that while its container is not running.
- A rental with an unclear answer is looked up, never retried. Finished takes are never paid for twice.
- Load only what you can afford to lose: the balance is the last backstop.

## What the checks can and cannot do

- **Speech** compares the words with the script. The recogniser mishears some correct words, so 15% errors pass. Listen to brand names yourself.
- **Face** catches no face, two faces, or a clearly different person. It cannot tell look-alikes apart. Confirm the face yourself.
- **Cut, freeze, loudness, file** are reliable.
- **Lip sync** is not checked. Watch it.

## Tests

```
py -m unittest tests.test_compute tests.test_generate tests.test_script tests.test_checks
py -m unittest tests.test_edit tests.test_e2e
```

No network, no key, no money. The fake servers follow the official documentation, but nothing has run on a real machine yet: the pilot is that test.
