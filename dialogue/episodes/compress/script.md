# "Where did eight go?" (campfire, Leo + Walter, ~55 s final, voice at 1.3x)

Premise: Leo zipped a ten-gigabyte folder and it came out at two, and he cannot let it go. Walter, his grandfather, walks him through compression in plain words. Both stay seated by the fire the whole time. The folder, the photos and the songs exist only in words and in the MG.
Payload: (1) ZIP is lossless: repeats become a short note ("la, six times"), unzip and every letter comes back; (2) photos and songs (JPEG, MP3) are lossy: they delete what the eye and ear barely catch (color detail, quiet sounds hidden by a loud one); (3) roughly ten times smaller; (4) lossy loses a bit every time you re-save; (5) you cannot squeeze a packed file again.
Human question: "Is my copy the real one?" Turn: for a song or photo it never is, it is only close enough that you do not notice. Landing: a packed suitcase does not shrink when you sit on it.
Running line: the folder, "ten gigabytes" (L1) and the "zip again" button (L17-L18).

LEO (curious) [CU]: Grandpa, my folder was ten gigabytes. Zipped, it's two. Where did the other eight go?
WALTER (amused) [MS]: Nowhere. It was mostly repeating itself.
LEO (curious) [OTS]: Repeating how?
WALTER (matter-of-fact) [MS]: Take la, la, la, la, la. Or just write: la, six times.
LEO (thinking) [OTS]: Same song, fewer letters.
WALTER (pleased) [MS]: And nothing lost. Unzip it, and every la comes back.
LEO (confused) [OTS]: But my photos aren't la, la, la.
WALTER (warm) [MS]: No. So photos get something sneakier. They throw things away.
LEO (shocked) [CU]: Throw away? Parts of my picture?
WALTER (matter-of-fact) [MS]: Only what your eyes miss. You see brightness sharply, color blurrily. So it keeps the sharp part, and blurs the color.
LEO (curious) [OTS]: And songs?
WALTER (firm, light) [MS]: A loud drum hides the quiet sounds beside it. You never hear them. MP3 deletes them.
LEO (surprised) [OTS]: It deletes what I can't hear?
WALTER (pleased) [2S]: Ten times smaller, and you don't notice.
LEO (shocked) [CU]: Wait. So it's never the real song?
WALTER (matter-of-fact) [MS]: Close enough. Save it again and again, and you get a photocopy of a photocopy.
LEO (grinning) [OTS]: So I zip the zip, till the whole movie is one byte!
WALTER (dry, flat) [CU]: Try it. A packed suitcase doesn't shrink when you sit on it.

#end

Delivery notes (voice): normal conversational pace (the track is sped up 1.3x after, pitch kept). Leo: curious, surprised, playful; L15 is the turn ("Wait."), a grin on L17. Walter: warm, smiling in the voice, falls to a low finish; only the last line is dry and flat, after a beat.
Seated: no actions at all. Nobody opens a folder or plays a song; the folder, the photos, the songs and the files are words + MG only.

<!-- Sources (plain terms)
- ZIP/DEFLATE is lossless: it replaces repeated strings with a (distance, length) back-reference (LZ77) and gives common symbols shorter codes (Huffman): RFC 1951 (DEFLATE); PKWARE APPNOTE.TXT. Unzipping gives back the exact original bytes.
- Typical ratios: text and source code often shrink 3-5x or more, so ten GB to two GB is plausible for a folder of text/documents/logs; already-compressed media (JPEG, MP3, MP4) barely shrinks. Illustrative, not a claim about every folder.
- JPEG is lossy: it converts RGB to brightness (Y) + two color channels (Cb, Cr), usually stores the color at lower resolution (chroma subsampling), then drops fine detail with a DCT and quantisation on 8x8 blocks, because human vision resolves brightness detail much better than color detail: ITU-T T.81 (JPEG); Wallace, "The JPEG Still Picture Compression Standard", IEEE Trans. Consumer Electronics 1992.
- MP3 uses a psychoacoustic model: auditory masking, where a loud sound makes quieter sounds at nearby frequencies inaudible, so those are coded coarsely or dropped: ISO/IEC 11172-3; Brandenburg, "MP3 and AAC Explained", AES 17th Int. Conf. 1999.
- About 10:1: CD audio is 1411 kbit/s, a 128 kbit/s MP3 is about 11x smaller (Fraunhofer / Brandenburg 1999); JPEG at normal quality is commonly 10:1 (Wallace 1992).
- Generation loss: re-saving a JPEG re-quantises it each time, so artefacts accumulate: Wikipedia "Generation loss" and JPEG FAQ (jpeg.org).
- A file cannot be compressed again and again: by the pigeonhole principle no lossless compressor can shrink every file, and compressed data looks random, so re-zipping a zip typically makes it slightly bigger: Salomon, "Data Compression: The Complete Reference"; comp.compression FAQ.
-->
