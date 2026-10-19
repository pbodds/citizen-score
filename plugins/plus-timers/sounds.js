// Alert sounds, made on the spot with the Web Audio API (no sound files): the
// Hidden Cube Alert's five, and four more. Each is a list of notes:
// [frequency Hz, start s, length s, wave, volume].
const SOUNDS = {
  chime: [[880, 0, 0.45, "sine", 0.25], [1320, 0.16, 0.5, "sine", 0.25]],
  bell: [[660, 0, 1.4, "sine", 0.28], [1320, 0, 0.9, "sine", 0.1], [1980, 0, 0.5, "sine", 0.05]],
  sparkle: [
    [1047, 0, 0.18, "triangle", 0.2], [1319, 0.08, 0.18, "triangle", 0.2],
    [1568, 0.16, 0.18, "triangle", 0.2], [2093, 0.24, 0.35, "triangle", 0.2],
  ],
  ping: [[1760, 0, 0.3, "sine", 0.22], [1760, 0.35, 0.3, "sine", 0.14]],
  soft: [[523, 0, 0.6, "sine", 0.18], [659, 0.22, 0.7, "sine", 0.16]],
  // A low struck gong: a deep note with its overtones, dying away slowly.
  gong: [[98, 0, 2.6, "sine", 0.32], [196, 0, 1.8, "sine", 0.12], [294, 0, 1.2, "triangle", 0.06], [415, 0.02, 0.8, "sine", 0.04]],
  // Two rising horn calls.
  horn: [[294, 0, 0.32, "sawtooth", 0.08], [392, 0.34, 0.55, "sawtooth", 0.09], [392, 0.34, 0.55, "sine", 0.12]],
  // A quick rising arpeggio, plucked.
  harp: [
    [523, 0, 0.5, "triangle", 0.18], [659, 0.07, 0.5, "triangle", 0.18], [784, 0.14, 0.5, "triangle", 0.18],
    [1047, 0.21, 0.6, "triangle", 0.18], [1319, 0.28, 0.8, "triangle", 0.16],
  ],
  // Two-tone alarm, three times: hard to miss.
  alarm: [
    [988, 0, 0.14, "square", 0.07], [784, 0.16, 0.14, "square", 0.07],
    [988, 0.32, 0.14, "square", 0.07], [784, 0.48, 0.14, "square", 0.07],
    [988, 0.64, 0.14, "square", 0.07], [784, 0.8, 0.14, "square", 0.07],
  ],
};

// How long a sound lasts, in seconds (its last note's end), for repeats.
const soundLength = (name) => Math.max(0, ...(SOUNDS[name] || []).map(([, start, length]) => start + length));

// One context for every alert. WebKitGTK (the meter on Linux) starts a new
// context suspended, its clock standing still until it is resumed, so it is
// resumed before each sound; WebView2 (Windows) starts it running.
//
// The resume is not awaited: in a hidden window WebKitGTK's resume() waits
// until the page is used, so an alert that waited for it stayed silent until
// the window was opened. Scheduled at once, the notes play as it resumes.
let audio = null;
// The notes still sounding, so a mute can cut them off.
const sounding = new Set();

async function playSound(name) {
  const notes = SOUNDS[name];
  if (!notes) return;
  try {
    audio ||= new AudioContext();
    if (audio.state !== "running") audio.resume().catch(() => {});
    const ctx = audio;
    for (const [freq, start, length, wave, volume] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const at = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(volume, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + length + 0.05);
      sounding.add(osc);
      osc.onended = () => sounding.delete(osc);
    }
  } catch {}
}

// Silence every note still playing or waiting to (an alert's Mute).
function stopSounds() {
  for (const osc of sounding) {
    try {
      osc.stop();
    } catch {}
  }
  sounding.clear();
}
