# Instrument auditions — approval before integration

This separate page does not modify or import the tree's runtime music. The
tree stays at its existing version until the visitor selects and approves a mix.

It provides two downloadable MP3 examples, three synthesized crystal-piano
variants of the same melody at comparable levels, and five separate backing
instruments. Trumpet is unchecked by default. Solo, channel levels, selection
summary and master volume let the visitor communicate a concrete choice.

All clips are 8 bars at 132 BPM, with identical sample counts and wrapped room
tails. Crystal leads retain their original melodic register and normalized
audible level rather than the tree's muted, lower-octave felt lead. These are
newly synthesized auditions, not sampled acoustic instruments or commercial
recordings. The public-domain melody is Jingle Bells (James Lord Pierpont, 1857).

Run `python3 scripts/render-music-lab.py` with the development environment's
NumPy/ffmpeg to regenerate files. Only `public/music-lab/` is written; the
approved tree recordings in `public/audio/` are never overwritten.

Native examples load on demand. The custom mixer lazily decodes eight tracks,
starts eight reusable loop sources at one timestamp, and changes gain nodes
instead of restarting clips. It pauses when the page hides. A compressor gives
extra headroom for selected combinations. No browser dependencies are added.
