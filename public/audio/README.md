# Christmas tree music

Newly synthesized, instrumental arrangements of James Lord Pierpont's public-domain
1857 melody *Jingle Bells*. These build on the approved fast `/music-preview/`
audition, with a softer lead and expanded rotation percussion. No commercial
recording or samples are used.

Both stems use the approved fast arrangement at **132 BPM**, with the same
16-bar phrase and exact sample count:

- `melody-loop.mp3`: a rounded felt-piano lead one octave below the original
  bright bell lead, with faint bell accents and a 1.4 kHz low-pass on the loop.
- `rhythm-brass-loop.mp3`: bass, offbeat chords, sleigh bells, prominent trumpet
  responses and electronic drums (four-on-the-floor kick, snare on two/four,
  eighth-note closed hats); audible only during rotation and its short release.

The accompaniment is mixed above the melody: target RMS .105 versus .046
(about +7.2 dB). Both stems share a peak ceiling of .78 for the summed mix, so
headroom adjustments preserve their relative levels. Electronic snare and hat
high frequencies are controlled to avoid replacing the old lead's sharpness
with harsh percussion. Original audition files remain unchanged.

There is no slow arrangement in the tree's playback. Rotating does not restart,
speed up, or fade the melody. Both stems start on the same audio-clock timestamp
and loop together, so accompaniment stays on the same beat and harmony. Silence
and fade-out are removed, and final notes/reverberation wrap into the first bar.

Regenerate with `python3 scripts/render-music-preview.py --loops-only` (Python,
NumPy, ffmpeg). Browser playback needs no additional package or external service.
The page enables music by default and attempts autoplay while loading audio.
If the browser blocks playback (including a pending `AudioContext.resume()`),
preparation still finishes, and the first pointer/touch/keyboard gesture retries.
The music button stays hidden throughout the opening and camera movement; it
appears with the other controls only when the tree reaches center stage
(`.stage-settled`). Music's autoplay/gesture behavior is independent of this
visual timing. Later gestures never override a visitor's mute choice.
Two Web Audio sources and
their gain nodes are reused across rotations and mute/resume. A 1.2-second fade
adds/removes accompaniment; a .75-second hold avoids switching on tiny drag pauses.
Music immediately mutes and suspends while the microphone is pending/active or
the page is hidden, and resumes only if the visitor still has music enabled.
