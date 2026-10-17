// Approved audition mix. Keep the original samples and apply percentages as
// gains, without re-rendering or normalizing away the listener's choices.
// The first track plays continuously; the remaining tracks follow rotation.
export const christmasMusicMix = {
  masterVolume: .5,
  compression: { threshold: -6, knee: 6, ratio: 8, attack: .003, release: .16 },
  tracks: [
    { file: 'music-lab/audio/crystal-round.mp3', label: '水晶鋼琴 B・圓潤', level: .4 },
    { file: 'music-lab/audio/electronic-drums.mp3', label: '電子鼓', level: 1.2 },
    { file: 'music-lab/audio/piano-rhythm.mp3', label: '節奏鋼琴', level: .9 },
    { file: 'music-lab/audio/bass.mp3', label: '彈跳低音', level: 1.2 },
    { file: 'music-lab/audio/sleigh-bells.mp3', label: '聖誕鈴鼓', level: .25 },
    { file: 'music-lab/audio/trumpet.mp3', label: '小號', level: .3 },
  ],
};
