"""Render our own instrumental Jingle Bells auditions (no sampled recordings).

Run with Python 3 + NumPy and ffmpeg available in the development environment:
    python3 scripts/render-music-preview.py
These tools are not runtime dependencies of the website.
"""

from pathlib import Path
import argparse
import subprocess
import tempfile
import wave

import numpy as np


RATE = 44100
OUTPUT = Path(__file__).resolve().parents[1] / 'public' / 'music-preview'
RNG = np.random.default_rng(2026)

# Public-domain melody by James Lord Pierpont, first published in 1857.
# C major; each list is one 4/4 bar, represented by (MIDI pitch, beats).
MELODY = [
    [(76, 1), (76, 1), (76, 2)],
    [(76, 1), (76, 1), (76, 2)],
    [(76, 1), (79, 1), (72, 1), (74, 1)],
    [(76, 4)],
    [(77, 1), (77, 1), (77, 1), (77, 1)],
    [(77, 1), (76, 1), (76, 1), (76, 1)],
    [(76, 1), (74, 1), (74, 1), (76, 1)],
    [(74, 2), (79, 2)],
    [(76, 1), (76, 1), (76, 2)],
    [(76, 1), (76, 1), (76, 2)],
    [(76, 1), (79, 1), (72, 1), (74, 1)],
    [(76, 4)],
    [(77, 1), (77, 1), (77, 1), (77, 1)],
    [(77, 1), (76, 1), (76, 1), (76, 1)],
    [(79, 1), (79, 1), (77, 1), (74, 1)],
    [(72, 4)],
]
CHORDS = [(48, 52, 55)] * 4 + [(53, 57, 60), (48, 52, 55), (43, 47, 50), (43, 47, 50)]
CHORDS += CHORDS[:6] + [(43, 47, 50), (48, 52, 55)]


def tone(pitch, duration, instrument):
    """Soft attacks, natural decays, and releases prevent clicks."""
    tail = .8 if instrument in ('pad', 'piano') else 1.3
    t = np.arange(int((duration + tail) * RATE)) / RATE
    frequency = 440 * 2 ** ((pitch - 69) / 12)
    phase = 2 * np.pi * frequency * t
    release = np.clip((duration + tail - t) / tail, 0, 1) ** 2
    if instrument == 'bell':
        signal = (np.sin(phase) * np.exp(-t / 1.25)
                  + .19 * np.sin(phase * 2.002) * np.exp(-t / .48)
                  + .045 * np.sin(phase * 3.98) * np.exp(-t / .22))
        attack = 1 - np.exp(-t / .006)
    elif instrument == 'piano':
        signal = (np.sin(phase) + .26 * np.sin(phase * 2) * np.exp(-t * 2)
                  + .085 * np.sin(phase * 3) * np.exp(-t * 4)) * np.exp(-t / .65)
        attack = 1 - np.exp(-t / .008)
    elif instrument == 'pad':
        signal = .5 * (np.sin(phase * .999) + np.sin(phase * 1.001)) + .09 * np.sin(phase * 2)
        attack = np.clip(t / .24, 0, 1)
    else:  # Round, short bass with no sub-bass rumble.
        signal = (np.sin(phase) + .22 * np.sin(phase * 2)) * np.exp(-t / .24)
        attack = 1 - np.exp(-t / .006)
    return signal * attack * release


def add(track, signal, when, volume, pan=0):
    start = round(when * RATE)
    length = min(len(signal), len(track) - start)
    if length <= 0:
        return
    angle = (pan + 1) * np.pi / 4
    track[start:start + length, 0] += signal[:length] * volume * np.cos(angle)
    track[start:start + length, 1] += signal[:length] * volume * np.sin(angle)


def render(lively, loop=False, separate=False):
    bpm = 132 if lively else 76
    beat = 60 / bpm
    length = 64 * beat
    track = np.zeros((round((length + 2) * RATE), 2), dtype=np.float64)
    backing = np.zeros_like(track) if separate else track
    for bar, (notes, chord) in enumerate(zip(MELODY, CHORDS)):
        start = bar * 4 * beat + .12
        position = 0
        for note_index, (pitch, beats) in enumerate(notes):
            when = start + position * beat
            velocity = [1, .86, .93, .87][note_index % 4]
            add(track, tone(pitch, beats * beat * .82, 'bell'), when, (.17 if lively else .115) * velocity, .08)
            add(track, tone(pitch - 12, beats * beat * .8, 'piano'), when, (.11 if lively else .095) * velocity, -.12)
            position += beats
        if lively:
            for tick in range(8):
                # A gentle swing in the accompaniment, while the tune stays clear.
                when = start + (tick * .5 + (.06 if tick % 2 else 0)) * beat
                if tick % 2 == 0:
                    bass = chord[0] - (12 if tick == 0 else 5)
                    add(backing, tone(bass, beat * .4, 'bass'), when, .14, -.1)
                else:
                    for pitch in chord:
                        add(backing, tone(pitch + 12, beat * .27, 'piano'), when, .049, -.35)
                # Quiet sleigh-bell shimmer, rather than a loud drum kit.
                t = np.arange(round(.10 * RATE)) / RATE
                shimmer = sum(np.sin(2 * np.pi * f * t) for f in [2860, 3691, 4517, 5743])
                shimmer *= (1 - np.exp(-t / .0015)) * np.exp(-t / .019)
                add(backing, shimmer, when, .009 if tick % 2 else .014, .45)
            # A soft brush on beats two and four gives the spin a clear pulse.
            for offset in [1, 3]:
                t = np.arange(round(.13 * RATE)) / RATE
                noise = RNG.normal(0, 1, len(t))
                brush = (noise - np.roll(noise, 1)) * np.exp(-t / .027) * (1 - np.exp(-t / .002))
                add(backing, brush, start + offset * beat, .012, .25)
            if separate:
                # A small, round kick supports the dance without a hard hit.
                t = np.arange(round(.18 * RATE)) / RATE
                phase = 2 * np.pi * (62 * t + 58 * .025 * (1 - np.exp(-t / .025)))
                kick = np.sin(phase) * np.exp(-t / .055) * (1 - np.exp(-t / .003))
                for offset in [0, 2]:
                    add(backing, kick, start + offset * beat, .10)
        else:
            for i, pitch in enumerate(chord):
                add(backing, tone(pitch, beat * 3.65, 'pad'), start, .022, [-.45, 0, .45][i])
            for tick in range(8):
                pitch = chord[[0, 1, 2, 1][tick % 4]] + 12
                add(backing, tone(pitch, beat * .45, 'piano'), start + tick * beat / 2, .042, -.3 if tick % 2 else .3)
            add(backing, tone(chord[0], beat * 1.5, 'bass'), start, .042, 0)

    # Short stereo reflections keep the melody distinct, with a little air.
    tracks = [track, backing] if separate else [track]
    for index, part in enumerate(tracks):
        dry = part.copy()
        for seconds, gain in [(.079, .14), (.131, .105), (.229, .075), (.367, .045)]:
            delay = round(seconds * RATE)
            part[delay:] += dry[:-delay, ::-1] * gain
        if loop:
            # Wrap each stem at exactly the same sample, including room tails.
            start = round(.12 * RATE)
            frames = round(length * RATE)
            body = part[start:start + frames].copy()
            tail = part[start + frames:]
            body[:len(tail)] += tail
            tracks[index] = body
    combined = sum(tracks)
    rms = np.sqrt(np.mean(combined ** 2))
    target_rms = .100 if lively else .058
    gain = min(target_rms / rms, .82 / np.max(np.abs(combined)))
    for part in tracks:
        part *= gain
        if not loop:
            fade_in = round(.08 * RATE)
            fade_out = round(1.2 * RATE)
            part[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
            part[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
    return (tracks if separate else tracks[0]), beat


def export(name, samples, output=OUTPUT):
    with tempfile.TemporaryDirectory() as temporary:
        wav = Path(temporary) / 'render.wav'
        with wave.open(str(wav), 'wb') as file:
            file.setnchannels(2)
            file.setsampwidth(2)
            file.setframerate(RATE)
            file.writeframes((np.clip(samples, -.99, .99) * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                        '-codec:a', 'libmp3lame', '-b:a', '128k', '-ar', str(RATE),
                        '-metadata', 'artist=GJ Christmas 2026', '-metadata', 'title=' + name,
                        str(output / (name + '.mp3'))], check=True)
    print(f'{name}: {len(samples) / RATE:.1f}s, peak {np.max(np.abs(samples)):.3f}, '
          f'RMS {20 * np.log10(np.sqrt(np.mean(samples ** 2))):.1f} dBFS')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--loops-only', action='store_true', help='Render the approved website loops without changing auditions')
    args = parser.parse_args()
    if args.loops_only:
        output = OUTPUT.parent / 'audio'
        output.mkdir(parents=True, exist_ok=True)
        stems, _ = render(True, loop=True, separate=True)
        for name, samples in zip(['melody-loop', 'rhythm-loop'], stems):
            export(name, samples, output)
        return
    OUTPUT.mkdir(parents=True, exist_ok=True)
    gentle, slow_beat = render(False)
    lively, fast_beat = render(True)
    export('gentle', gentle)
    export('lively', lively)

    # Audition the proposed mood change: quiet -> spin -> quiet. These are
    # crossfades between arrangements, not a sudden playback-rate jump.
    slow = gentle[:round(16 * slow_beat * RATE)]
    fast = lively[:round(32 * fast_beat * RATE)]
    ending = gentle[round(48 * slow_beat * RATE):]
    overlap = round(1.4 * RATE)
    demo = slow.copy()
    for segment in [fast, ending]:
        fade = np.linspace(0, 1, overlap)[:, None]
        demo[-overlap:] = demo[-overlap:] * (1 - fade) + segment[:overlap] * fade
        demo = np.concatenate([demo, segment[overlap:]])
    export('transition', demo)


if __name__ == '__main__':
    main()
