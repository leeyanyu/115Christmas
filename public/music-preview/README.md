# GJ Christmas music auditions

These files are a separate audition page at `/115Christmas/music-preview/`.
They are not loaded by the Christmas tree page and do not change its behavior.

The melody of *Jingle Bells* was composed by James Lord Pierpont and first
published in 1857; the composition is in the public domain. These recordings
are newly synthesized instrumental arrangements made for this project.
No commercial recording, sample library, vocals, or external music API is used.

- `gentle.mp3`: 76 BPM; music-box melody, soft piano, warm sustained harmony.
- `lively.mp3`: 132 BPM; bells, piano, bass, and quiet sleigh/brush percussion.
- `transition.mp3`: gentle → lively → gentle, with 1.4-second crossfades.

Regenerate using `python3 scripts/render-music-preview.py` with NumPy and
ffmpeg available locally. The website needs no additional dependencies.
Files are stereo, 44.1 kHz, 128 kbps MP3. The lively version has a moderately
higher level; generated peaks remain below full scale. Audition-page playback
requires a user gesture, pauses other tracks, and pauses when the page hides.

After musical approval, rotation detection, return-to-idle timing, a mute
control, microphone interaction, looping, and transition timing must be
integrated separately. In particular, music should duck or pause while the
microphone listens so playback cannot accidentally supply the singing energy.
