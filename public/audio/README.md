# Christmas tree music

Newly synthesized, instrumental arrangements of James Lord Pierpont's public-domain
1857 melody *Jingle Bells*. These use the same arrangement and timbres as the
approved `/music-preview/` auditions. No commercial recording or samples are used.

`gentle-loop.mp3` is 76 BPM; `lively-loop.mp3` is 132 BPM and moderately louder.
Both contain 16 bars, with the preview's silence and fade-out removed and the
final notes/reverberation wrapped into the next first bar for continuous looping.

Regenerate with `python3 scripts/render-music-preview.py --loops-only` (Python,
NumPy, ffmpeg). Browser playback needs no additional package or external service.
Audio is fetched only after tapping the music icon. Two Web Audio sources and
their gain nodes are reused across rotations and mute/resume. A 1.4-second fade
connects the two moods; a .75-second hold avoids switching on tiny drag pauses.
Music immediately mutes and suspends while the microphone is pending/active or
the page is hidden, and resumes only if the visitor still has music enabled.
