# ref1

```
{
 "name": "ref1",
 "dur": 177.2,
 "words": 571,
 "sentences": 84,
 "wps": 3.23,
 "words_per_sentence": 6.8,
 "pitch_range_st_p10_p90": 4.4,
 "median_f0_hz": 263.0,
 "word_pitch_sd_st": 2.66,
 "loudness_sd_db": 1.43,
 "sentence_pause_mean": 0.22,
 "inner_pauses_per_sentence": 0.17,
 "inner_pause_mean": 0.17,
 "falling_end_pct": 13.0,
 "rising_end_pct": 10.0,
 "sentence_start_st": -0.07,
 "sentence_end_st": -0.17,
 "emph_per_sentence": 0.63,
 "peak_position": 0.46,
 "questions": 5,
 "music_bed_db_below_speech": 5.1
}
```

   0.0s  How LLMs are built. →   (4w 3.3w/s, start +0.8 peak@2/4 end -0.3 st, range 1.5 st) [0.14]
   1.4s  How do you actually build a large language model like ChatGPT or Claude? →   (13w 3.6w/s, start +0.0 peak@3/13 end -0.8 st, range 3.4 st) [0.14]
   5.1s  From the outside, [0.14] it looks like magic. →   (7w 4.5w/s, start -0.1 peak@6/7 end +0.5 st, range 1.9 st) [0.10]
   6.8s  You type a question and SOMEHOW billions of numbers inside a computer produce a USEFUL answer. →   (16w 3.8w/s, start -0.2 peak@6/16 end -0.0 st, range 4.8 st) [0.22]
  11.2s  But it's REALLY A long pipeline. →   (6w 4.1w/s, start -5.2 peak@3/6 end -1.6 st, range 5.7 st) [0.22]
  12.9s  Let's WALK THROUGH IT. ↗   (4w 4.3w/s, start -3.8 peak@4/4 end +2.5 st, range 11.7 st) [0.14]
  14.0s  Step 1. →   (2w 3.2w/s, start +0.6 peak@2/2 end +0.6 st, range 0.0 st) [0.22]
  14.8s  Data. →   (1w 4.2w/s, start +0.0 peak@1/1 end +0.0 st, range 0.0 st) [0.22]
  15.3s  You collect enormous amounts of text, books, [0.14] webpages, [0.14] code, [0.14] articles, [0.20] forums, [0.20] reference material. →   (13w 2.7w/s, start +0.1 peak@11/13 end +1.8 st, range 3.4 st) [0.36]
  20.4s  Then YOU clean IT, remove DUPLICATES, FILTER out low -quality content, [0.18] strip BROKEN data, [0.18] and convert EVERYTHING into a format the model can train on. →   (25w 3.3w/s, start +2.4 peak@4/25 end -0.8 st, range 25.7 st) [0.18]
  28.1s  Now THE FIRST KEY CONCEPT. ↗   (5w 3.5w/s, start -6.1 peak@4/5 end +0.4 st, range 15.2 st) [0.50]
  30.0s  Tokens. →   (1w 2.9w/s, start +2.0 peak@1/1 end +2.0 st, range 0.0 st) [0.24]
  30.6s  LLMs don't read text the way humans do. →   (8w 3.8w/s, start +0.9 peak@1/8 end -0.8 st, range 2.5 st) [0.14]
  32.8s  A sentence gets broken into smaller pieces called tokens. ↘   (9w 3.3w/s, start +0.0 peak@8/9 end -3.7 st, range 5.2 st) [0.36]
  35.9s  A TOKEN might be a word, part of a word, or punctuation. →   (12w 4.5w/s, start +2.6 peak@2/12 end -0.4 st, range 5.5 st) [0.38]
  38.9s  Unbelievable might become several tokens. ↘   (5w 2.4w/s, start +1.8 peak@1/5 end -1.6 st, range 4.2 st) [0.26]
  41.3s  Those tokens then become numbers. →   (5w 3.2w/s, start +0.0 peak@2/5 end -1.3 st, range 1.3 st) [0.28]
  43.1s  Each one is converted into a vector called an embedding. →   (10w 3.8w/s, start +0.1 peak@5/10 end +0.3 st, range 2.7 st) [0.06]
  45.8s  That's what the neural network actually works with. ↗   (8w 4.2w/s, start -1.0 peak@8/8 end +2.0 st, range 4.6 st) [0.20]
  47.9s  Now we build the model itself. →   (6w 4.9w/s, start +1.2 peak@2/6 end +0.2 st, range 1.6 st) [0.30]
  49.4s  Most modern LLMs use an architecture called the transformer. →   (9w 3.4w/s, start +0.3 peak@7/9 end +0.0 st, range 1.1 st) [0.38]
  52.5s  It's made of many layers, and the most important mechanism inside them is attention. →   (14w 3.9w/s, start +1.3 peak@3/14 end +0.0 st, range 5.1 st) [0.38]
  56.5s  Attention lets the model look at surrounding tokens and decide which one's megalomaniacal. →   (13w 3.7w/s, start +1.5 peak@2/13 end -0.9 st, range 4.3 st) [0.02]
  60.0s  It doesn't matter for understanding the current one. →   (8w 5.6w/s, start +0.0 peak@7/8 end +0.8 st, range 2.4 st) [0.12]
  61.6s  Take the sentence. →   (3w 4.7w/s, start -1.0 peak@3/3 end +0.6 st, range 1.6 st) [0.20]
  62.4s  The programmer fixed the server because it crashed. →   (8w 3.6w/s, start +0.9 peak@4/8 end +0.3 st, range 1.1 st) [0.18]
  64.8s  When the model sees it, [0.14] attention CONNECTS that word back to server. ↗   (12w 4.0w/s, start -4.3 peak@7/12 end +1.2 st, range 6.8 st) [0.22]
  68.0s  Now imagine DOING THAT across TRILLIONS OF EXAMPLES. ↗   (8w 3.1w/s, start -12.0 peak@6/8 end +0.5 st, range 23.8 st) [0.36]
  70.9s  At the start, the model knows nothing. →   (7w 4.8w/s, start +0.0 peak@3/7 end -0.1 st, range 2.1 st) [0.20]
  72.6s  Its weights are random. →   (4w 4.2w/s, start +1.2 peak@3/4 end +1.4 st, range 0.8 st) [0.18]
  73.7s  So we give it one SIMPLE task. →   (7w 4.8w/s, start -2.6 peak@6/7 end +1.4 st, range 5.2 st) [0.24]
  75.4s  Predict the next token. →   (4w 4.2w/s, start +0.7 peak@4/4 end +1.5 st, range 0.8 st) [0.22]
  76.6s  Input the capital of Japan is. →   (6w 3.2w/s, start +1.5 peak@2/6 end +1.2 st, range 0.7 st) [0.20]
  78.7s  The model says London. →   (4w 3.7w/s, start +1.6 peak@2/4 end +0.0 st, range 1.6 st) [0.32]
  80.1s  Wrong. →   (1w 2.3w/s, start +0.0 peak@1/1 end +0.0 st, range 0.0 st) [0.06]
  80.6s  A loss function measures how wrong. →   (6w 3.1w/s, start -1.5 peak@3/6 end +0.1 st, range 2.0 st) [0.28]
  82.8s  Back PROPAGATION FIGURES OUT which WEIGHTS CAUSE THE error. ↗   (9w 3.1w/s, start -10.6 peak@6/9 end -0.1 st, range 23.5 st) [0.16]
  85.9s  Gradient descent nudges them slightly in a better direction. →   (9w 3.7w/s, start +0.7 peak@1/9 end +1.1 st, range 2.5 st) [0.30]
  88.6s  Then we do it again. →   (5w 6.0w/s, start +0.4 peak@3/5 end +2.1 st, range 2.0 st) [0.56]
  90.0s  And again. →   (2w 5.3w/s, start +0.0 peak@1/2 end +0.0 st, range 0.0 st) [0.18]
  90.6s  Across enormous DATASETS on thousands of GPUs for weeks OR months. →   (11w 2.9w/s, start -0.2 peak@10/11 end -1.2 st, range 5.4 st) [0.16]
  94.5s  That's pre -training. →   (3w 3.1w/s, start +1.7 peak@3/3 end +1.7 st, range 0.0 st) [0.24]
  95.7s  It's where most of the model's knowledge and capability comes FROM. ↗   (11w 3.8w/s, start -5.1 peak@11/11 end +0.8 st, range 5.9 st) [0.12]
  98.7s  But there's a problem. →   (4w 5.3w/s, start -2.5 peak@4/4 end -1.1 st, range 1.6 st) [0.26]
  99.7s  A pre -trained model is basically a very powerful autocomplete. →   (10w 3.1w/s, start +0.0 peak@3/10 end -1.2 st, range 2.9 st) [0.18]
 103.1s  It doesn't automatically behave like a helpful assistant. →   (8w 3.6w/s, start -0.1 peak@3/8 end -1.1 st, range 2.1 st) [0.30]
 105.6s  So next comes post -training. →   (5w 3.7w/s, start +0.0 peak@1/5 end +0.0 st, range 0.0 st) [0.18]
 107.1s  First supervised fine -tuning. →   (4w 2.6w/s, start +0.7 peak@2/4 end -0.1 st, range 1.0 st) [0.26]
 108.9s  HUMANS OR carefully generated datasets provide examples of good behavior. ↘   (10w 2.9w/s, start +2.4 peak@1/10 end -2.9 st, range 5.7 st) [0.34]
 112.7s  Question. →   (1w 3.1w/s, start +0.0 peak@1/1 end +0.0 st, range 0.0 st) [0.16]
 113.2s  Ideal answer. →   (2w 2.7w/s, start -0.7 peak@1/2 end -1.1 st, range 0.9 st) [0.20]
 114.1s  Question. →   (1w 3.1w/s, start +0.0 peak@1/1 end +0.0 st, range 0.0 st) [0.26]
 114.7s  Ideal answer. →   (2w 2.9w/s, start +0.8 peak@1/2 end +0.7 st, range 0.2 st) [0.18]
 115.6s  The model learns to respond like an assistant. →   (8w 4.6w/s, start -2.4 peak@4/8 end -1.0 st, range 2.7 st) [0.28]
 117.6s  Then reinforcement learning. →   (3w 2.4w/s, start -1.8 peak@2/3 end -3.1 st, range 1.3 st) [0.00]
 118.8s  Humans OR automated systems compare outputs, [0.22] reward the better ones, [0.12] and push THE model toward answers that are more useful, accurate, [0.20] and safe. →   (23w 3.4w/s, start -2.8 peak@13/23 end -1.9 st, range 7.5 st) [0.16]
 125.7s  Right? →   (1w 5.6w/s, start +0.0 peak@1/1 end +0.0 st, range 0.0 st) [0.16]
 126.0s  Modern reasoning models also use reinforcement learning with verifiable rewards. →   (10w 2.5w/s, start -0.1 peak@9/10 end +0.3 st, range 2.6 st) [0.40]
 130.4s  Did THE math answer match? ↘   (5w 4.9w/s, start +6.3 peak@2/5 end -3.3 st, range 11.8 st) [0.06]
 131.5s  Did the code pass the tests? →   (6w 4.5w/s, start +0.7 peak@2/6 end +0.0 st, range 1.5 st) [0.26]
 133.0s  Did the agent finish the task? →   (6w 3.8w/s, start -0.1 peak@4/6 end -1.2 st, range 2.4 st) [0.18]
 134.8s  Now we HAVE a trained model. ↘   (6w 5.4w/s, start +3.5 peak@3/6 end -3.1 st, range 7.1 st) [0.12]
 136.0s  But it's enormous. →   (3w 4.3w/s, start -1.0 peak@3/3 end +0.8 st, range 1.8 st) [0.18]
 136.9s  Maybe hundreds of billions of parameters. ↘   (6w 3.9w/s, start +0.8 peak@3/6 end -0.7 st, range 3.3 st) [0.44]
 138.9s  RUNNING it becomes its own engineering problem. →   (7w 3.6w/s, start +2.3 peak@1/7 end +0.4 st, range 6.6 st) [0.30]
 141.2s  The MODEL GETS split ACROSS many GPUS. ↗   (7w 3.3w/s, start -7.0 peak@3/7 end +0.8 st, range 18.2 st) [0.02]
 143.3s  Weights get quantized to use less memory. →   (7w 3.7w/s, start +0.0 peak@3/7 end -0.1 st, range 3.3 st) [0.34]
 145.5s  Requests get batched together. →   (4w 3.0w/s, start +1.5 peak@1/4 end -0.2 st, range 1.7 st) [0.22]
 147.1s  And specialized inference systems. →   (4w 2.3w/s, start +1.7 peak@2/4 end -1.6 st, range 3.3 st) [0.00]
 148.8s  Schedule thousands of users on the same hardware. →   (8w 3.5w/s, start +0.4 peak@7/8 end +0.9 st, range 4.6 st) [0.24]
 151.4s  So the full journey. →   (4w 4.7w/s, start +0.0 peak@4/4 end +2.0 st, range 0.0 st) [0.10]
 152.3s  Collect data. →   (2w 3.3w/s, start +0.0 peak@1/2 end +0.0 st, range 0.0 st) [0.22]
 153.1s  TOKENIZE it. ↘   (2w 3.2w/s, start -1.3 peak@1/2 end -3.4 st, range 4.3 st) [0.08]
 153.8s  TURN tokens into embeddings. ↘   (4w 3.2w/s, start +1.8 peak@1/4 end -2.0 st, range 4.3 st) [0.08]
 155.2s  Build a transformer. →   (3w 4.2w/s, start +3.8 peak@2/3 end +2.2 st, range 1.7 st) [0.28]
 156.2s  Train IT TO predict the next token. →   (7w 4.9w/s, start -1.1 peak@2/7 end -1.0 st, range 8.7 st) [0.22]
 157.8s  Use gradient descent to adjust billions of weights. ↘   (8w 3.4w/s, start +2.1 peak@2/8 end -1.6 st, range 4.6 st) [0.16]
 160.3s  Post -train it to behave. ↘   (5w 5.2w/s, start +3.3 peak@2/5 end +0.0 st, range 2.0 st) [0.36]
 161.6s  Then OPTIMIZE it so people can actually use it at scale. →   (11w 4.4w/s, start +1.8 peak@2/11 end +0.0 st, range 3.9 st) [0.28]
 164.4s  And here's the weird part. ↘   (5w 5.7w/s, start +2.2 peak@4/5 end -0.4 st, range 3.1 st) [0.14]
 165.4s  Nobody manually programs how to write Python, [0.12] explain physics, or translate French. →   (12w 3.2w/s, start +0.6 peak@9/12 end -0.7 st, range 3.4 st) [0.20]
 169.4s  Those abilities emerge from one extremely SIMPLE objective, [0.30] repeated AT enormous scale. →   (12w 3.0w/s, start +0.5 peak@7/12 end +0.0 st, range 5.3 st) [0.28]
 173.7s  Predict what comes next. →   (4w 3.1w/s, start -0.5 peak@2/4 end -2.2 st, range 1.7 st) [0.02]
 175.0s  AND get slightly less wrong every time. →   (7w 4.1w/s, start +6.9 peak@1/7 end +0.6 st, range 7.9 st) [0.00]
