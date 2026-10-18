# Christmas tree music

The live tree uses the approved `/music-lab/` audition samples unchanged.
`src/integrations/christmas-music-mix.js` records the selected mix:

| Part | Sample | Gain |
| --- | --- | --- |
| Continuous melody | 水晶鋼琴 A・透明 / `crystal-clear.mp3` | 100% |
| Rotation accompaniment | 電子鼓 / `electronic-drums.mp3` | 70% |
| Rotation accompaniment | 節奏鋼琴 / `piano-rhythm.mp3` | 20% |
| Rotation accompaniment | 彈跳低音 / `bass.mp3` | 60% |
| Rotation accompaniment | 聖誕鈴鼓 / `sleigh-bells.mp3` | 10% |
| Rotation accompaniment | 小號 / `trumpet.mp3` | 15% |

All six samples are in `public/music-lab/audio/`. The master gain is **100%**,
following the same shared compressor as the audition mixer (threshold -6 dB,
knee 6 dB, ratio 8, attack .003 s, release .16 s). Instrument percentages are
individual amplitude gains; there is no new normalization or MP3 re-encoding.
The repeated trumpet entry in the selection means one trumpet at 15%.

These are newly synthesized, instrumental arrangements of James Lord Pierpont's
public-domain 1857 melody *Jingle Bells*. No commercial recording or samples are
used. The approved eight-bar loop runs at **132 BPM**. All sources share one
start timestamp and loop boundary, so switching accompaniment never restarts or
changes the crystal piano's tempo. Manual, idle and party rotations use the same
3-second raised-cosine accompaniment fade-in, with a .75-second hold for small
drag pauses. Starting or resuming music uses a 2.4-second raised-cosine master
fade-in. Accompaniment also starts silent and fades in if rotation began while
the samples were still loading.
Stopping uses a 4.2-second raised-cosine fade-out: a gentle start, gradual
reduction and a quiet tail. A new turn cancels the release at the current gain
before fading back in. Switching music off uses a 1.4-second fade, and suspension
waits for it to finish. These envelopes run on the audio clock, independently of
the scene's frame rate. Microphone activation and page hiding still mute at once.

Playback attempts autoplay; a first pointer/touch/keyboard gesture retries if
the browser blocks it. The music icon stays hidden throughout the opening and
camera movement, appearing only at `.stage-settled`. Later gestures cannot
override the visitor's mute choice. Music immediately mutes and suspends while
the microphone is pending/active or the page is hidden. Resume honors the mute
choice and returns to the selected 100% master. Six source/gain pairs are reused
across rotations and mute/resume, and all nodes are released on disposal.

The older `melody-loop.mp3` and `rhythm-brass-loop.mp3` in this directory are
retained historical mixes; the live tree no longer requests them. No additional
browser dependency or external audio service is required.
