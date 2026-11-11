// The display's sounds, made in code with the Web Audio API: no sound files and no musical notes. Every
// sound is shaped noise, so it is a tick, a knock, a thud or a whoosh, never a tone or a tune. Browsers
// let a page make sound only after a click or a key, so sound starts with the display's first click; the
// referee can mute it from the referee screen.

export type Sound =
  | 'tick' // a second goes by in the last five
  | 'click' // the numbers, the answer, the permits
  | 'pop' // a challenge won; a mission done
  | 'thud' // a building lands; a mission failed
  | 'knock' // the gavel twice: an auction declared
  | 'gavel' // the gavel three times: an auction won
  | 'timeUp' // a low double knock: the time is up
  | 'whoosh' // a question or a challenge comes on screen; night falls
  | 'swish' // a card taken
  | 'swoosh' // a card used
  | 'sparkle'; // the crown lands

/** One burst of filtered noise: which filter, its frequency (sweeping to `to`), how long, and how loud. */
type Burst = { after: number; filter: BiquadFilterType; from: number; to?: number; q?: number; length: number; attack?: number; level: number };

const knock = (after: number, from: number, level: number): Burst => ({ after, filter: 'bandpass', from, q: 5, length: 0.07, level });

const SOUNDS: Record<Sound, Burst[]> = {
  tick: [{ after: 0, filter: 'highpass', from: 4200, length: 0.025, level: 0.45 }],
  click: [{ after: 0, filter: 'bandpass', from: 2300, q: 1.4, length: 0.045, level: 0.55 }],
  pop: [{ after: 0, filter: 'bandpass', from: 700, to: 2600, q: 2.2, length: 0.08, level: 0.7 }],
  thud: [{ after: 0, filter: 'lowpass', from: 300, to: 70, q: 0.9, length: 0.24, level: 1 }],
  knock: [knock(0, 950, 0.9), knock(0.16, 950, 0.8)],
  gavel: [knock(0, 950, 0.9), knock(0.15, 950, 0.85), knock(0.3, 820, 1)],
  timeUp: [
    { after: 0, filter: 'bandpass', from: 330, q: 3, length: 0.13, level: 1 },
    { after: 0.22, filter: 'bandpass', from: 300, q: 3, length: 0.16, level: 1 },
  ],
  whoosh: [{ after: 0, filter: 'bandpass', from: 300, to: 1700, q: 0.8, length: 0.45, attack: 0.16, level: 0.45 }],
  swish: [{ after: 0, filter: 'highpass', from: 1300, to: 5200, length: 0.3, attack: 0.08, level: 0.4 }],
  swoosh: [{ after: 0, filter: 'bandpass', from: 2600, to: 420, q: 0.9, length: 0.36, attack: 0.07, level: 0.5 }],
  // Quick high ticks, each fainter: a sparkle with no pitch to it.
  sparkle: [0, 0.05, 0.11, 0.18, 0.26, 0.35, 0.45].map(
    (after, k): Burst => ({ after, filter: 'highpass', from: 6000 + k * 300, length: 0.05, level: 0.4 * Math.pow(0.8, k) }),
  ),
};

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

/** On the display's first click or key: from then on the display may make sound. */
export function unlockSound(): void {
  if (!context) {
    const Context = window.AudioContext as typeof AudioContext | undefined;
    if (!Context) return;
    context = new Context();
    // One second of white noise, which every sound filters and shapes.
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  void context.resume();
}

/** The referee's mute, as the latest snapshot says. */
export function setSoundMuted(value: boolean): void {
  muted = value;
}

/** Whether the display can be heard now: after the first click, and not muted. */
const soundOn = (): boolean => !muted && context?.state === 'running';

/** Plays a sound now, or `delay` seconds from now. Silent until the first click, and when muted. */
export function playSound(sound: Sound, delay = 0): void {
  if (!context || !noise || !soundOn()) return;
  const start = context.currentTime + delay;
  for (const burst of SOUNDS[sound]) play(context, noise, start + burst.after, burst);
}

function play(ctx: AudioContext, buffer: AudioBuffer, at: number, burst: Burst): void {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = burst.filter;
  filter.Q.value = burst.q ?? 1;
  filter.frequency.setValueAtTime(burst.from, at);
  if (burst.to) filter.frequency.exponentialRampToValueAtTime(burst.to, at + burst.length);
  const gain = ctx.createGain();
  const attack = burst.attack ?? 0.004;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(burst.level, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + burst.length);
  source.connect(filter).connect(gain).connect(ctx.destination);
  // A different stretch of the noise each time, so no two knocks sound exactly alike.
  source.start(at, Math.random() * 0.6);
  source.stop(at + burst.length + 0.05);
}
