# ref4

```
{
 "name": "ref4",
 "dur": 128.8,
 "words": 432,
 "sentences": 52,
 "wps": 3.37,
 "words_per_sentence": 8.3,
 "pitch_range_st_p10_p90": 10.4,
 "median_f0_hz": 242.6,
 "word_pitch_sd_st": 6.54,
 "loudness_sd_db": 1.89,
 "sentence_pause_mean": 0.22,
 "inner_pauses_per_sentence": 0.48,
 "inner_pause_mean": 0.21,
 "falling_end_pct": 17.0,
 "rising_end_pct": 31.0,
 "sentence_start_st": -5.3,
 "sentence_end_st": -1.18,
 "emph_per_sentence": 1.54,
 "peak_position": 0.45,
 "questions": 11,
 "music_bed_db_below_speech": 4.0
}
```

   0.0s  CICD explained, [0.28] are you still uploading code to production by hand, you SSH into the server, [0.16] pull the latest code, [0.22] run some random commands, [0.22] restart THE app, and hope NOTHING breaks? →   (31w 3.5w/s, start +0.0 peak@26/31 end -1.8 st, range 11.0 st) [0.22]
   9.1s  That is risky, because a HUMAN HAS TO REMEMBER EVERY step. ↗   (11w 4.1w/s, start -20.6 peak@10/11 end +0.9 st, range 21.5 st) [0.50]
  12.3s  CICD automates that work, and it has two PARTS, [0.18] CONTINUOUS INTEGRATION and continuous DELIVERY, [0.18] or continuous deployment. ↗   (17w 2.8w/s, start +0.7 peak@9/17 end +1.4 st, range 24.8 st) [0.18]
  18.5s  Let's START with CI. ↘   (4w 5.9w/s, start +4.7 peak@2/4 end +0.1 st, range 4.6 st) [0.16]
  19.3s  Imagine five developers working on the same app. →   (8w 3.8w/s, start +0.0 peak@7/8 end -0.4 st, range 1.5 st) [0.12]
  21.5s  One CHANGES AUTHENTICATION, [0.42] ANOTHER PAYMENTS, [0.18] another the database. ↗   (8w 2.6w/s, start +0.2 peak@5/8 end +0.0 st, range 20.9 st) [0.40]
  25.0s  Everyone IS PUSHING CODE CONSTANTLY. ↗   (5w 3.0w/s, start -9.8 peak@2/5 end +0.4 st, range 21.6 st) [0.12]
  26.7s  Without automation, [0.12] someone has to check everything by hand. →   (9w 3.7w/s, start -0.4 peak@3/9 end +0.0 st, range 1.2 st) [0.00]
  29.1s  Does it compile? →   (3w 4.4w/s, start +0.0 peak@1/3 end +0.0 st, range 0.0 st) [0.26]
  30.1s  Do the tests pass? ↘   (4w 4.4w/s, start +2.1 peak@1/4 end +0.0 st, range 0.0 st) [0.22]
  31.2s  Did somebody break the build? →   (5w 4.4w/s, start +2.7 peak@2/5 end -0.5 st, range 3.2 st) [0.16]
  32.5s  Is the formatting correct? →   (4w 4.3w/s, start +0.0 peak@3/4 end +4.3 st, range 0.2 st) [0.26]
  33.7s  Are there security ISSUES? ↗   (4w 4.0w/s, start -20.7 peak@4/4 end +2.3 st, range 23.0 st) [0.24]
  34.9s  That gets painful fast. →   (4w 3.5w/s, start -22.8 peak@2/4 end -22.8 st, range 0.0 st) [0.32]
  36.4s  So with CI, EVERY PUSH RUNS a pipeline AUTOMATICALLY. ↗   (9w 3.8w/s, start -10.8 peak@5/9 end +1.3 st, range 22.9 st) [0.36]
  39.2s  It installs dependencies, [0.44] runs THE linner, runs unit tests and integration tests, [0.18] BUILDS THE APPLICATION, [0.28] and maybe scans FOR vulnerabilities. →   (20w 3.0w/s, start -20.6 peak@14/20 end -0.1 st, range 24.5 st) [0.40]
  46.1s  If SOMETHING fails, the pipeline turns red, and that code IS not merged until it is fixed. ↘   (17w 4.4w/s, start +2.3 peak@2/17 end -5.1 st, range 7.3 st) [0.18]
  50.2s  So CI MEANS INTEGRATE often and automatically VERIFY nothing broke. →   (10w 2.9w/s, start -7.7 peak@2/10 end +0.2 st, range 25.7 st) [0.20]
  53.8s  Now comes CD. →   (3w 4.2w/s, start +0.0 peak@1/3 end +0.0 st, range 0.0 st) [0.20]
  54.7s  Once the code is tested, it needs to reach an environment, [0.16] staging, then production. →   (14w 4.2w/s, start +0.0 peak@9/14 end +1.9 st, range 4.5 st) [0.24]
  58.3s  The pipeline builds. →   (3w 4.1w/s, start +2.5 peak@2/3 end +0.9 st, range 1.6 st) [0.14]
  59.1s  The release artifact may be a Docker image, [0.14] and deploys IT to STAGING, [0.14] where more CHECKS run. →   (17w 4.3w/s, start -2.2 peak@11/17 end +0.3 st, range 9.9 st) [0.18]
  63.2s  With continuous delivery, [0.28] a human still approves production. ↗   (8w 2.8w/s, start -20.6 peak@1/8 end +0.0 st, range 0.0 st) [0.32]
  66.4s  Someone clicks deploy. ↗   (3w 3.3w/s, start -20.7 peak@1/3 end +0.0 st, range 0.0 st) [0.34]
  67.6s  Continuous deployment goes one step further. ↗   (6w 3.2w/s, start -20.6 peak@1/6 end +0.0 st, range 0.0 st) [0.18]
  69.7s  If all checks pass, [0.24] it deploys straight to PRODUCTION. ↗   (9w 3.7w/s, start -20.6 peak@9/9 end -0.6 st, range 20.0 st) [0.22]
  72.4s  No human needed. ↘   (3w 3.9w/s, start +2.5 peak@2/3 end -0.8 st, range 3.3 st) [0.12]
  73.2s  Here is the full flow. →   (5w 5.7w/s, start +0.0 peak@1/5 end +0.0 st, range 0.0 st) [0.14]
  74.3s  You push code to GitHub, [0.16] which TRIGGERS GitHub actions. →   (9w 3.8w/s, start +0.0 peak@7/9 end -1.0 st, range 11.2 st) [0.20]
  76.8s  The tests pass. →   (3w 4.7w/s, start -20.6 peak@1/3 end -20.7 st, range 0.1 st) [0.24]
  77.7s  A DOCKER image is BUILT AND PUSHED TO a registry. →   (10w 4.5w/s, start -9.8 peak@6/10 end -0.8 st, range 22.3 st) [0.28]
  80.2s  Staging is updated, [0.22] and health checks pass. ↗   (7w 3.6w/s, start -20.6 peak@1/7 end +0.0 st, range 2.2 st) [0.28]
  82.4s  And with continuous DEPLOYMENT, [0.20] the new VERSION rolls OUT TO production AUTOMATICALLY. ↗   (12w 3.8w/s, start -13.1 peak@7/12 end -1.6 st, range 21.6 st) [0.42]
  86.0s  But CI CD is not just about speed. →   (8w 4.7w/s, start +2.7 peak@2/8 end +0.0 st, range 7.4 st) [0.20]
  87.9s  It IS ABOUT MAKING RELEASES. ↗   (5w 4.3w/s, start -11.4 peak@5/5 end -0.3 st, range 20.2 st) [0.04]
  89.1s  The deployment IS WRITTEN as code, [0.18] so the same STEPS run every time. →   (13w 3.3w/s, start +0.1 peak@4/13 end +1.1 st, range 5.4 st) [0.20]
  93.3s  What if something still goes wrong in production? →   (8w 4.9w/s, start +0.0 peak@5/8 end +0.3 st, range 2.1 st) [0.32]
  95.2s  A good pipeline supports rolling deployments, blue -GREEN deployments, or canary releases. ↘   (12w 3.0w/s, start +0.0 peak@8/12 end -1.9 st, range 5.8 st) [0.28]
  99.6s  With canary, only 5 % of users get the new version first. →   (12w 4.2w/s, start +2.3 peak@2/12 end +1.2 st, range 2.6 st) [0.24]
 102.7s  If ERROR RATES STAY NORMAL, GO TO 25%, then 50, [0.18] then 100. ↘   (12w 3.2w/s, start +2.1 peak@7/12 end -20.4 st, range 22.9 st) [0.22]
 106.7s  If things break, [0.18] you ROLL BACK. ↗   (6w 4.3w/s, start -20.7 peak@5/6 end +1.0 st, range 22.6 st) [0.22]
 108.3s  This is where monitoring matters. ↘   (5w 4.1w/s, start +0.0 peak@3/5 end -1.4 st, range 3.9 st) [0.20]
 109.7s  A deployment should not just ask, did the SERVER START? ↗   (10w 4.4w/s, start +2.1 peak@9/10 end +5.2 st, range 6.3 st) [0.30]
 112.3s  Are health checks failing? →   (4w 4.2w/s, start +0.0 peak@3/4 end -0.1 st, range 1.0 st) [0.14]
 113.4s  BECAUSE a deployment can't succeed while the app IS still broken. ↗   (11w 4.4w/s, start -0.1 peak@1/11 end +0.0 st, range 6.6 st) [0.06]
 115.9s  So remember IT like this. →   (5w 4.9w/s, start -3.1 peak@3/5 end -1.1 st, range 4.3 st) [0.16]
 117.1s  CI answers. →   (2w 2.9w/s, start +0.4 peak@1/2 end +0.3 st, range 0.1 st) [0.16]
 117.9s  Is this code safe to merge? →   (6w 5.1w/s, start +0.0 peak@5/6 end +0.5 st, range 2.5 st) [0.00]
 119.1s  CRECD answers. →   (2w 1.9w/s, start +3.5 peak@1/2 end +3.5 st, range 0.0 st) [0.20]
 120.4s  Can we safely release it? →   (5w 4.2w/s, start -3.0 peak@5/5 end +1.4 st, range 4.3 st) [0.04]
 121.6s  Together THEY turn SOFTWARE delivery from a manual ritual into an automated pipeline. →   (13w 3.6w/s, start -0.7 peak@2/13 end -0.1 st, range 6.4 st) [0.32]
 125.6s  From code CHANGE, [0.14] to tested SOFTWARE, [0.26] to production. ↘   (8w 2.9w/s, start -5.5 peak@6/8 end -7.9 st, range 9.4 st) [0.00]
