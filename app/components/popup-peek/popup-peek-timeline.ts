// popup-peek-timeline.ts — the single source of truth for the interaction.
// Vendored from design_handoff_popup_peek/popup-peek-timeline.js (Claude Design
// project "Mascot jumping animation"). Ported to TS; the only behavioural change
// is the `shift` argument on edgePath(), which lets the rig centre itself on
// cards wider than the 480px the RIG constants were authored against.
//
// Times are absolute ms from the moment the modal mounts (ENTER) or is dismissed (EXIT).
// Each key is [time, value, easingName]. Easing applies INTO that key.

export type Bez = [number, number, number, number];
export type Key = [number, number] | [number, number, string];
export type Timeline = Partial<Record<Channel, Key[]>>;

export const BEZ: Record<string, Bez> = {
  sine:    [.37, 0, .63, 1],   // Weight   — cyclical idle
  sineIn:  [.4, 0, 1, 1],
  expoOut: [.16, 1, .3, 1],    // Pull     — the climb
  softOut: [.22, 1, .36, 1],   // Settle   — card entry, hand reveal
  quintIn: [.6, 0, .9, .35],   // Drop     — descent
  linear:  [0, 0, 1, 1]
};

export const ENTER: Timeline = {
  scrim:       [[0, 0], [240, 1, 'sine']],
  cardY:       [[0, 20], [420, 0, 'expoOut']],
  cardScale:   [[0, .93], [330, 1.012, 'expoOut'], [470, 1, 'sine']],
  cardOpacity: [[0, 0], [180, 1, 'sine']],
  handL:       [[790, 0], [1050, 1, 'softOut']],
  handR:       [[860, 0], [1120, 1, 'softOut']],
  handDrop:    [[790, -13], [1080, 0, 'expoOut']],
  dip:         [[1020, 0], [1180, 7, 'expoOut'], [1560, 4.4, 'sine'], [2000, 3.4, 'sine']],
  cardSquash:  [[1020, 0], [1200, 1, 'expoOut'], [1440, -.32, 'sine'], [1620, 0, 'sine']],
  cardRoll:    [[0, 0]],
  rigY:        [[1060, 300], [1160, 311, 'sine'], [1480, -16, 'expoOut'], [1680, 0, 'softOut']],
  headRotX:    [[1100, -21], [1440, -18, 'sine'], [1680, 3, 'expoOut'], [1820, 0, 'sine']],
  headRotZ:    [[0, 0]],
  earSkew:     [[0, 0]],
  mouth:       [[1400, 0], [1700, 1, 'expoOut']],
  eyeScale:    [[0, 1], [2000, 1, 'linear'], [2095, .14, 'sine'], [2240, 1, 'sine'],
                        [3000, 1, 'linear'], [3095, .14, 'sine'], [3240, 1, 'sine']],
  mouthO:      [[0, 0]]
};

export const EXIT: Timeline = {
  eyeScale:    [[0, 1]],
  mouthO:      [[0, 0]],
  mouth:       [[0, 1], [520, .55, 'sine']],
  earSkew:     [[0, 0]],
  rigY:        [[0, 0], [110, -7, 'expoOut'], [300, 58, 'sine'], [390, 64, 'sine'], [620, 320, 'sineIn']],
  headRotX:    [[0, 0], [280, -6, 'sine'], [580, 0, 'sine']],
  headRotZ:    [[0, 0]],
  handL:       [[430, 1], [620, 0, 'sineIn']],
  handR:       [[470, 1], [670, 0, 'sineIn']],
  handDrop:    [[340, 0], [660, 15, 'sineIn']],
  dip:         [[0, 3.4], [280, 6.2, 'sine'], [540, 0, 'expoOut'], [660, -1.4, 'sine'], [780, 0, 'sine']],
  cardSquash:  [[0, 0], [290, .8, 'sine'], [540, 0, 'expoOut']],
  cardRoll:    [[0, 0]],
  cardY:       [[700, 0], [940, 8, 'sineIn']],
  cardScale:   [[700, 1], [940, .965, 'sineIn']],
  cardOpacity: [[720, 1], [960, 0, 'sine']],
  scrim:       [[740, 1], [980, 0, 'sine']]
};

export const CLOSED = {
  scrim: 0, cardY: 20, cardScale: .93, cardOpacity: 0, handL: 0, handR: 0,
  handDrop: -13, dip: 0, cardSquash: 0, cardRoll: 0, rigY: 300, headRotX: -21,
  headRotZ: 0, earSkew: 0, mouth: 0, eyeScale: 1, mouthO: 0
};

export type Channel = keyof typeof CLOSED;
export type Sampled = Record<Channel, number>;

export const ENTER_DURATION = 3480; // enter + two blinks, then the exit may begin
export const EXIT_DURATION = 1020;

// Rig geometry, in design units of the 492 x 608 art plate.
export const RIG = {
  plate: { w: 492, h: 608 },
  scale: 0.46,                    // rendered size = plate * scale
  clip: { w: 226, h: 243 },       // clip box; its BOTTOM edge is the card's top edge
  offsetLeft: 155,                // clip box left, relative to a 480px-wide card
  eyeL: { x: 32,  y: 304, w: 44, h: 100 },
  eyeR: { x: 200, y: 304, w: 72, h: 104 },
  mouth: { cx: 136, cy: 412, halfWidth: 24 },
  hand: { w: 44, h: 50, marginTop: -24, leftX: 142, rightX: 294, cx: 22 }
};

/** The card width the RIG offsets above were authored against. */
export const RIG_BASE_WIDTH = 480;

/** Horizontal offset that re-centres the rig on a card of any width. */
export function rigShift(cardWidth: number): number {
  return (cardWidth - RIG_BASE_WIDTH) / 2;
}

function bezier(p: Bez, t: number): number {
  const [x1, y1, x2, y2] = p;
  let u = t;
  for (let i = 0; i < 5; i++) {
    const v = 1 - u;
    const x = 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u - t;
    const d = 3 * v * v * x1 + 6 * v * u * (x2 - x1) + 3 * u * u * (1 - x2);
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
  }
  u = Math.max(0, Math.min(1, u));
  const v = 1 - u;
  return 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u;
}

/** Sample one channel at time t (ms). */
export function track(keys: Key[] | undefined, t: number): number {
  if (!keys || !keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i];
      const span = b[0] - a[0] || 1;
      return a[1] + (b[1] - a[1]) * bezier(BEZ[b[2] || 'sine'], (t - a[0]) / span);
    }
  }
  return keys[keys.length - 1][1];
}

/** Sample every channel of a timeline at time t. */
export function sample(timeline: Timeline, t: number, fallback: Sampled = CLOSED): Sampled {
  const out = {} as Sampled;
  for (const k in fallback) {
    const key = k as Channel;
    out[key] = timeline[key] ? track(timeline[key], t) : fallback[key];
  }
  return out;
}

/**
 * The deformable top edge of the card. Returns an SVG path 'd'.
 * `shift` slides the two grip points horizontally so they stay under the paws
 * when the card is wider than RIG_BASE_WIDTH.
 */
export function edgePath(dip: number, cardWidth = 480, radius = 28, shift = 0): string {
  const d = Math.max(0, dip);
  const lx = RIG.hand.leftX + RIG.hand.cx + shift;
  const rx = RIG.hand.rightX + RIG.hand.cx + shift;
  const mid = (lx + rx) / 2;
  return 'M0 64 L0 ' + radius + ' Q0 0 ' + radius + ' 0 ' +
    'C ' + (lx - 44) + ' 0 ' + (lx - 20) + ' ' + d + ' ' + lx + ' ' + d +
    ' C ' + (lx + 22) + ' ' + d + ' ' + (lx + 40) + ' ' + (d * .12) + ' ' + mid + ' ' + (d * .34) +
    ' C ' + (rx - 40) + ' ' + (d * .12) + ' ' + (rx - 22) + ' ' + d + ' ' + rx + ' ' + d +
    ' C ' + (rx + 20) + ' ' + d + ' ' + (cardWidth - radius) + ' 0 ' + (cardWidth - radius) + ' 0 ' +
    'Q' + cardWidth + ' 0 ' + cardWidth + ' ' + radius + ' L' + cardWidth + ' 64 Z';
}
