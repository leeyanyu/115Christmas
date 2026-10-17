"""Build isolated instrument auditions; never write to the tree's audio folder.

Run: python3 scripts/render-music-lab.py (NumPy and ffmpeg required locally).
All recordings use our own synthesis and the public-domain Jingle Bells melody.
"""
from pathlib import Path
import importlib.util
import json
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
OUTPUT = ROOT / 'public' / 'music-lab' / 'audio'
spec = importlib.util.spec_from_file_location('christmas_audio', ROOT / 'scripts' / 'render-music-preview.py')
audio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audio)
RATE, BEAT = audio.RATE, 60 / 132
FRAMES = round(32 * BEAT * RATE)


def crystal(pitch, duration, variant):
    t = np.arange(round((duration + 1.2) * RATE)) / RATE
    frequency = 440 * 2 ** ((pitch - 69) / 12)
    phase = 2 * np.pi * frequency * t
    second, third, glass, attack = {
        'clear': (.19, .045, .018, .009),
        'round': (.10, .022, .008, .014),
        'bright': (.27, .065, .026, .007),
    }[variant]
    signal = (np.sin(phase) * np.exp(-t / 1.25)
              + second * np.sin(phase * 2.001) * np.exp(-t / .5)
              + third * np.sin(phase * 3.002) * np.exp(-t / .3)
              + glass * np.sin(phase * 4.01) * np.exp(-t / .18)
              + .19 * np.sin(phase / 2) * np.exp(-t / .75))
    envelope = (1 - np.exp(-t / attack)) * np.clip((duration + 1.2 - t) / 1.2, 0, 1) ** 2
    return signal * envelope


def room_and_loop(part):
    dry = part.copy()
    for seconds, gain in [(.071, .10), (.137, .075), (.223, .04)]:
        delay = round(seconds * RATE)
        part[delay:] += dry[:-delay, ::-1] * gain
    start = round(.08 * RATE)
    result = part[start:start + FRAMES].copy()
    tail = part[start + FRAMES:]
    result[:len(tail)] += tail
    return result


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ids = ['crystal-clear', 'crystal-round', 'crystal-bright', 'electronic-drums', 'piano-rhythm', 'bass', 'sleigh-bells', 'trumpet']
    tracks = {name: np.zeros((FRAMES + round(2 * RATE), 2)) for name in ids}
    drums = {kind: audio.electronic_drum(kind) for kind in ['kick', 'snare', 'hat']}
    for bar, (notes, chord) in enumerate(zip(audio.MELODY[:8], audio.CHORDS[:8])):
        start = .08 + bar * 4 * BEAT
        position = 0
        for index, (pitch, beats) in enumerate(notes):
            for variant in ['clear', 'round', 'bright']:
                audio.add(tracks['crystal-' + variant], crystal(pitch, beats * BEAT * .8, variant),
                          start + position * BEAT, [1, .87, .94, .9][index % 4], -.05)
            position += beats
        for tick in range(8):
            when = start + tick * BEAT / 2
            audio.add(tracks['electronic-drums'], drums['hat'], when, .09 if tick % 2 else .07, .25)
            if tick % 2 == 0:
                # Higher bass harmonics make the groove audible on phone speakers.
                audio.add(tracks['electronic-drums'], drums['kick'], when, 1, 0)
                bass_pitch = chord[0] + (0 if tick in [0, 4] else 7)
                audio.add(tracks['bass'], audio.tone(bass_pitch, BEAT * .44, 'bass'), when, .7, -.12)
            if tick in [2, 6]:
                audio.add(tracks['electronic-drums'], drums['snare'], when, .9, .1)
            if tick % 2:
                for pitch in chord:
                    audio.add(tracks['piano-rhythm'], audio.tone(pitch + 12, BEAT * .28, 'piano'), when, .3, -.25)
            t = np.arange(round(.09 * RATE)) / RATE
            shimmer = sum(np.sin(2 * np.pi * frequency * t) for frequency in [2330, 3070, 3910]) / 3
            shimmer *= (1 - np.exp(-t / .002)) * np.exp(-t / .023)
            audio.add(tracks['sleigh-bells'], shimmer, when, .6 if tick % 2 else .45, .35)
        for offset, pitch, beats in [(1.5, chord[2] + 12, .35), (3, chord[1] + 12, .6)]:
            audio.add(tracks['trumpet'], audio.tone(pitch, beats * BEAT, 'trumpet'), start + offset * BEAT, .7, -.2)

    for name, part in tracks.items():
        part = room_and_loop(part)
        part *= min(.105 / np.sqrt(np.mean(part ** 2)), .64 / np.max(np.abs(part)))
        tracks[name] = part
        audio.export(name, part, OUTPUT)

    defaults = {'electronic-drums': 85, 'piano-rhythm': 70, 'bass': 65, 'sleigh-bells': 30, 'trumpet': 35}
    mix = tracks['crystal-clear'].copy()
    for name in ['electronic-drums', 'piano-rhythm', 'bass', 'sleigh-bells']:
        mix += tracks[name] * defaults[name] / 100
    mix *= min(.13 / np.sqrt(np.mean(mix ** 2)), .82 / np.max(np.abs(mix)))
    audio.export('happy-example', mix, OUTPUT)

    labels = [
        ('crystal-clear', '水晶鋼琴 A・透明', '清楚的琴音與少量晶亮泛音。', 'lead'),
        ('crystal-round', '水晶鋼琴 B・圓潤', '保留水晶感，起音更柔和。', 'lead'),
        ('crystal-bright', '水晶鋼琴 C・明亮', '更閃亮的琴音，適合比較亮度。', 'lead'),
        ('electronic-drums', '電子鼓', '四拍大鼓、小鼓與踩鈸，建立活潑節奏。', 'backing'),
        ('piano-rhythm', '節奏鋼琴', '短促的反拍和弦，讓音樂有彈跳感。', 'backing'),
        ('bass', '彈跳低音', '支撐律動，保留手機較容易聽見的中低頻。', 'backing'),
        ('sleigh-bells', '聖誕鈴鼓', '輕巧的鈴聲，增加聖誕氣氛。', 'backing'),
        ('trumpet', '小號', '短句點綴，可自行決定是否加入。', 'backing'),
    ]
    catalog = {'bpm': 132, 'seconds': FRAMES / RATE, 'tracks': [
        {'id': name, 'label': label, 'description': description, 'family': family,
         'file': f'audio/{name}.mp3', 'volume': 100 if family == 'lead' else defaults[name],
         'enabled': family == 'backing' and name != 'trumpet'}
        for name, label, description, family in labels
    ]}
    (OUTPUT.parent / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
