/**
 * <mascot-voice> — a voice-conversation mascot: listens, thinks, speaks, and asks.
 * Dependency-free custom element. Asset: hi-body.png (the 123x202 front-facing sprite).
 *
 *   <script type="module" src="/mascot-voice/mascot-voice.js"></script>
 *   <mascot-voice size="240" state="listening" assets="/mascot-voice/"></mascot-voice>
 *
 * Drive it from your STT/TTS layer:
 *   el.state = 'idle' | 'listening' | 'thinking' | 'speaking' | 'asking'
 *   el.text  = 'the line being spoken, or the live transcript'
 *   el.level = 0..1        — live audio level from an AnalyserNode (see README)
 *   el.blink()             — force a blink
 *
 * Use 'asking' whenever the reply ends in a question: that's what tips the head back,
 * lifts the brows and floats the "?" bubble. 'speaking' and 'asking' fire a 'spoken'
 * event when the line finishes; every state otherwise holds until you change it.
 * If you never set `level`, the mouth runs on an envelope synthesised from `text` —
 * plausible, and it keeps working on TTS engines that expose no audio node.
 * Honors prefers-reduced-motion (drops breath, bob and rings; keeps gaze and mouth).
 */

const S = 1.9;                       // sprite art is 123x202; stage is that x S
const BOX = { w: 123 * S, h: 202 * S };
const SEAM = 65;                     // sprite y where the ears layer is cut from the body
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const bell = (p) => (p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p));

// One pose per state. Springs supply all easing, lag and overlap.
// lean/ty tilt and lift the body, ear cocks the ears, gx/gy aim the eyes,
// eyeSY/eyeSX size them, brow raises the brows, ring/glow drive the aura.
const POSE = {
  idle:      { lean: 0,   ty: 0,  ear: 0,    eyeSY: 1,    eyeSX: 1,    gx: 0,    gy: 0,    brow: 0,    glow: .24, ring: 0,   sc: 1 },
  listening: { lean: 3.4, ty: -3, ear: 1,    eyeSY: 1.09, eyeSX: 1.05, gx: 0,    gy: .28,  brow: .22,  glow: .5,  ring: 1,   sc: 1.015 },
  thinking:  { lean: -8,  ty: 1,  ear: -.5,  eyeSY: .78,  eyeSX: .97,  gx: -.75, gy: -.7,  brow: .45,  glow: .3,  ring: 0,   sc: 1 },
  speaking:  { lean: -1,  ty: -1, ear: .3,   eyeSY: 1,    eyeSX: 1,    gx: 0,    gy: 0,    brow: .12,  glow: .42, ring: .4,  sc: 1.005 },
  asking:    { lean: -3,  ty: -4, ear: .8,   eyeSY: 1.12, eyeSX: 1.05, gx: 0,    gy: -.14, brow: .95,  glow: .46, ring: .3,  sc: 1.02 },
};
// Resting mouth curve per state (sprite px of droop at the centre). Speaking overrides it.
const SMILE = { idle: 3.8, listening: 3.4, thinking: -.6, speaking: 1.6, asking: 1.6 };
const ACCENT = { idle: '#a98fdc', listening: '#35b083', thinking: '#dd9c33', speaking: '#7b52c9', asking: '#c25ba2' };
const EYE = 'linear-gradient(178deg,#1d1540 0%,#0b0719 46%,#3c2b66 80%,#a37ccf 100%)';
const PATCH = 'linear-gradient(180deg,#faf1fc 0%,#f6ecfa 55%,#efe1f7 100%)';

/** Fake a speech envelope from text, for when no analyser is connected. */
function utterance(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const syl = [];
  let t = .2, seed = words.length * 7 + String(text || '').length + 1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (const w of words) {
    const n = Math.max(1, Math.round(w.replace(/[^A-Za-z\u2019']/g, '').length / 2.7));
    for (let i = 0; i < n; i++) {
      const d = .14 + rnd() * .12;              // syllable length — raise to slow speech
      syl.push({ t0: t, d, peak: .42 + rnd() * .58, wide: rnd() });
      t += d + .022 + rnd() * .034;             // gap between syllables
    }
    t += /[,.\u2014;:?!]$/.test(w) ? .28 : .08; // punctuation / word pause
  }
  return { syl, dur: t + .34 };
}

class MascotVoice extends HTMLElement {
  static observedAttributes = ['size', 'state', 'text', 'level', 'assets', 'motion'];

  get state() { return this.getAttribute('state') || 'idle'; }
  set state(v) { this.setAttribute('state', v || 'idle'); }
  get text() { return this.getAttribute('text') || ''; }
  set text(v) { this.setAttribute('text', v == null ? '' : v); }
  /** Live audio level, 0..1. Set it every frame while audio plays; it decays on its own. */
  get level() { return this.ext; }
  set level(v) { this.ext = clamp(parseFloat(v) || 0, 0, 1); this.extAt = performance.now() / 1000; }
  /** Characters of `text` that have been "said" so far — drive your caption reveal from this. */
  get spokenChars() { return Math.round(this.progress * this.text.length); }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.a = { lean: 0, ty: 0, ear: 0, eyeSY: 1, eyeSX: 1, gx: 0, gy: 0, brow: 0, glow: .24, ring: 0, sc: 1, amp: 0, smile: 3.8, open: 0, wide: .4 };
    this.v = {};
    this.ext = -1; this.extAt = -9; this.progress = 0;
    this.blinkAt = -9; this.blinkNext = 2.4; this.dbl = false;
    this.phaseAt = performance.now() / 1000;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.utt = null; this.#retime();
    this.#build();
    this.#size();
    // rAF is scheduled BEFORE the tick and the tick is guarded: one bad frame must not
    // kill the loop and silently drop the rig to the 33ms fallback below.
    const loop = () => {
      if (!this.isConnected) return;
      this.raf = requestAnimationFrame(loop);
      this.last = performance.now() / 1000;
      this.#safeTick(this.last);
    };
    this.raf = requestAnimationFrame(loop);
    // keeps the rig alive if rAF is throttled (background tab, hidden frame)
    this.iv = setInterval(() => { const t = performance.now() / 1000; if (t - (this.last || 0) > .12) this.#safeTick(t); }, 33);
  }

  disconnectedCallback() { cancelAnimationFrame(this.raf); clearInterval(this.iv); }

  attributeChangedCallback(name, was, now) {
    if (!this.shadowRoot || was === now) return;
    if (name === 'size') return this.#size();
    if (name === 'assets') { this.#build(); return this.#size(); }
    if (name === 'level') return (this.level = now);
    if (name === 'state') { this.phaseAt = performance.now() / 1000; this.spoke = false; this.#retime(); }
    if (name === 'text') this.#retime();
  }

  blink() { this.blinkAt = performance.now() / 1000; }

  /** True while a speaking/asking line is still playing out. */
  get busy() { const s = this.state; return (s === 'speaking' || s === 'asking') && this.progress < 1; }

  #retime() {
    const s = this.state;
    this.utt = (s === 'speaking' || s === 'asking') ? utterance(this.text) : null;
    this.progress = this.utt ? 0 : 1;
  }

  #build() {
    const base = this.getAttribute('assets') || './';
    const eye = (l, t, w, h, pl, pt, pw, ph) => `
      <div style="position:absolute;left:${l}px;top:${t}px;width:${w}px;height:${h}px;border-radius:50%;background:${PATCH};overflow:hidden">
        <div data-pupil style="position:absolute;left:${pl}px;top:${pt}px;width:${pw}px;height:${ph}px;transform-origin:50% 50%">
          <div style="position:absolute;inset:0;border-radius:50%;background:${EYE}">
            <div style="position:absolute;left:16%;top:11%;width:40%;height:24%;border-radius:50%;background:#fff;opacity:.97"></div>
            <div style="position:absolute;left:50%;top:68%;width:28%;height:16%;border-radius:50%;background:#e7d8ff;opacity:.38"></div>
          </div>
        </div>
      </div>`;
    const ring = (d, w) => `<div data-ring style="position:absolute;left:50%;top:50%;width:${d}px;height:${d}px;margin:${-d / 2}px 0 0 ${-d / 2}px;border-radius:50%;border:${w}px solid rgba(107,66,183,.7);opacity:0"></div>`;
    const dot = () => '<div data-dot style="width:10px;height:10px;border-radius:50%;background:#dd9c33;box-shadow:0 4px 10px -4px rgba(74,44,128,.55)"></div>';

    this.shadowRoot.innerHTML = `
      <style>:host{display:inline-block;position:relative;overflow:visible;line-height:0;font-family:inherit}</style>
      <div data-stage style="position:absolute;left:0;top:0;width:${BOX.w}px;height:${BOX.h}px">

        <div data-aura style="position:absolute;left:50%;top:52%;width:0;height:0;pointer-events:none">
          ${ring(500, 1.5)}${ring(400, 1.5)}${ring(306, 1.75)}
          <div data-glow style="position:absolute;left:-220px;top:-220px;width:440px;height:440px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.9),rgba(255,255,255,0) 70%);opacity:.24"></div>
        </div>

        <div data-shadow style="position:absolute;left:50%;top:${BOX.h - 22}px;width:230px;height:30px;margin-left:-115px;border-radius:50%;background:radial-gradient(closest-side,rgba(84,48,142,.32),rgba(84,48,142,0))"></div>

        <div style="position:absolute;left:0;top:0;width:123px;height:202px;transform-origin:0 0;transform:scale(${S})">
          <div data-body style="position:absolute;left:0;top:0;width:123px;height:202px;transform-origin:47% 96%;filter:saturate(1.08) drop-shadow(0 14px 20px rgba(74,44,128,.22))">
            <!-- two clipped copies of the sprite so the ears can move on their own -->
            <img data-ears src="${base}hi-body.png" alt="" style="position:absolute;left:0;top:0;width:123px;height:202px;clip-path:inset(0 0 ${202 - SEAM}px 0);transform-origin:61px ${SEAM}px">
            <img src="${base}hi-body.png" alt="Voice mascot" style="position:absolute;left:0;top:0;width:123px;height:202px;clip-path:inset(${SEAM}px 0 0 0)">

            ${eye(3.5, 71, 20, 38, 3, 5, 14, 28)}
            ${eye(45.5, 69, 28, 41, 3.5, 5, 21, 31)}

            <svg data-lids viewBox="0 0 123 202" style="position:absolute;left:0;top:0;width:123px;height:202px;opacity:0">
              <path d="M5 91 Q13.5 86.5 22 91" fill="none" stroke="#3a2a63" stroke-width="1.9" stroke-linecap="round"></path>
              <path d="M47.5 90 Q59.5 85 71.5 90" fill="none" stroke="#3a2a63" stroke-width="1.9" stroke-linecap="round"></path>
            </svg>
            <svg data-brows viewBox="0 0 123 202" style="position:absolute;left:0;top:0;width:123px;height:202px;opacity:0">
              <path d="M5 66 Q13.5 62.5 22 66" fill="none" stroke="#8c6fc2" stroke-width="1.7" stroke-linecap="round"></path>
              <path d="M47.5 64 Q59.5 60 71.5 64" fill="none" stroke="#8c6fc2" stroke-width="1.7" stroke-linecap="round"></path>
            </svg>

            <div style="position:absolute;left:23px;top:95.5px;width:23px;height:14px;border-radius:7px;background:linear-gradient(180deg,#f9f0fc 0%,#f5ebfa 60%,#f1e4f8 100%)"></div>
            <svg viewBox="0 0 123 202" style="position:absolute;left:0;top:0;width:123px;height:202px">
              <ellipse data-mo cx="34" cy="103" rx="4" ry="1" fill="#3d2c63" opacity="0"></ellipse>
              <path data-mouth d="M27 101 Q34 104.8 41 101" fill="none" stroke="#5b4489" stroke-width="1.5" stroke-linecap="round"></path>
            </svg>
          </div>
        </div>

        <div data-dots style="position:absolute;left:${BOX.w * .64}px;top:2px;display:flex;gap:7px;opacity:0">${dot()}${dot()}${dot()}</div>

        <div data-q style="position:absolute;left:${BOX.w * .64}px;top:-30px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:50% 50% 50% 8px;background:#fff;box-shadow:0 14px 26px -12px rgba(74,44,128,.6),0 0 0 1px rgba(151,116,206,.16);font:800 32px/1 'Plus Jakarta Sans',system-ui,sans-serif;color:${ACCENT.asking};opacity:0;transform-origin:20% 90%">?</div>

        <div data-wave style="position:absolute;left:-38px;top:84px;width:52px;height:52px;opacity:0">
          <div style="position:absolute;inset:0;border-radius:50%;border:2.75px solid ${ACCENT.listening};border-right-color:transparent;border-bottom-color:transparent;transform:rotate(-45deg)"></div>
          <div style="position:absolute;left:13px;top:13px;right:13px;bottom:13px;border-radius:50%;border:2.75px solid rgba(53,176,131,.8);border-right-color:transparent;border-bottom-color:transparent;transform:rotate(-45deg)"></div>
        </div>
      </div>`;

    const q = (s) => this.shadowRoot.querySelector(s);
    this.el = {
      stage: q('[data-stage]'), body: q('[data-body]'), ears: q('[data-ears]'),
      lids: q('[data-lids]'), brows: q('[data-brows]'), mouth: q('[data-mouth]'), mo: q('[data-mo]'),
      aura: q('[data-aura]'), glow: q('[data-glow]'), shadow: q('[data-shadow]'),
      dots: q('[data-dots]'), q: q('[data-q]'), wave: q('[data-wave]'),
      pupils: this.shadowRoot.querySelectorAll('[data-pupil]'),
      rings: this.shadowRoot.querySelectorAll('[data-ring]'),
      dot: this.shadowRoot.querySelectorAll('[data-dot]'),
    };
  }

  #size() {
    const size = parseFloat(this.getAttribute('size') || BOX.w);
    const k = size / BOX.w;
    this.style.width = size + 'px';
    this.style.height = BOX.h * k + 'px';
    this.el.stage.style.transformOrigin = '0 0';
    this.el.stage.style.transform = 'scale(' + k + ')';
  }

  #step(k, target, kp, d) {
    this.v[k] = ((this.v[k] || 0) + (target - this.a[k]) * kp) * d;
    this.a[k] += this.v[k];
  }

  /** Loudest syllable overlapping t (seconds into the line). */
  #syl(t) {
    if (!this.utt) return null;
    for (const s of this.utt.syl) if (t >= s.t0 && t <= s.t0 + s.d) return s;
    return null;
  }
  #envelope(t) {
    if (!this.utt) return 0;
    let v = 0;
    for (const s of this.utt.syl) {
      if (t < s.t0 - .04) break;
      if (t > s.t0 + s.d) continue;
      v = Math.max(v, bell((t - s.t0) / s.d) * s.peak);
    }
    return v;
  }

  #safeTick(t) {
    try { this.#tick(t); }
    catch (e) { if (!this.warned) { this.warned = true; console.error('<mascot-voice> frame error', e); } }
  }

  #tick(t) {
    const a = this.a, E = this.el, M = this.state, p = POSE[M] || POSE.idle;
    const amp = this.reduce ? 0 : clamp(parseFloat(this.getAttribute('motion') || 1), 0, 2);
    const pt = t - this.phaseAt;
    const speaking = M === 'speaking' || M === 'asking';

    if (this.utt) {
      this.progress = clamp((pt - .12) / Math.max(.001, this.utt.dur - .4), 0, 1);
      if (this.progress >= 1 && !this.spoke) { this.spoke = true; this.dispatchEvent(new CustomEvent('spoken', { detail: this.text })); }
    }
    // the last third of a question is where it reads as a question
    const ask = M === 'asking' && this.utt ? clamp((pt - this.utt.dur * .62) / (this.utt.dur * .38), 0, 1) : 0;

    // audio level: a real analyser if one is feeding us, else the synthesised envelope
    let lvl = 0;
    if (this.ext >= 0 && t - this.extAt < .4) lvl = this.ext;
    else if (this.utt) lvl = this.#envelope(pt);
    else if (M === 'listening') lvl = .18 + .32 * (.5 + .5 * Math.sin(t * 7.7)) * (.4 + .6 * (.5 + .5 * Math.sin(t * 2.7)));
    this.#step('amp', lvl, lvl > a.amp ? .34 : .16, .6);

    const breath = Math.sin(t * 2 * Math.PI / 3.1) * 1.1 * amp;
    const bob = speaking ? Math.sin(t * 2 * Math.PI / 1.35) * 1.4 * a.amp * amp : 0;
    const nod = M === 'listening' ? -a.amp * 4.2 * amp : 0;

    this.#step('lean', p.lean - ask * 5, .11, .78);
    this.#step('ty', p.ty - ask * 3, .12, .76);
    this.#step('ear', p.ear, .13, .74);
    this.#step('eyeSY', p.eyeSY + ask * .1, .16, .7);
    this.#step('eyeSX', p.eyeSX + ask * .04, .14, .72);
    this.#step('gx', p.gx + (M === 'thinking' ? Math.sin(pt * 1.1) * .18 : Math.sin(t * .5) * .12), .13, .74);
    this.#step('gy', p.gy + (M === 'thinking' ? Math.sin(pt * .77) * .12 : 0), .13, .74);
    this.#step('brow', p.brow + ask * .5, .12, .76);
    this.#step('glow', p.glow, .08, .8);
    this.#step('ring', p.ring, .1, .8);
    this.#step('sc', p.sc + ask * .012, .1, .8);
    this.#step('smile', speaking ? SMILE[M] : (SMILE[M] ?? 3.8), .14, .72);

    // mouth: height follows the level, width opens on vowels
    const syl = speaking ? this.#syl(pt) : null;
    let open = speaking ? clamp(a.amp * 1.25, 0, 1) : 0;
    if (ask > .55) open = Math.max(open, .5 * ask);      // a question settles open, not shut
    this.#step('open', open, .4, .5);
    this.#step('wide', syl ? syl.wide : .4, .3, .58);

    if (t > this.blinkNext) { this.blinkAt = t; this.dbl = Math.random() < .2; this.blinkNext = t + (M === 'listening' ? 3.6 : 2.5) + Math.random() * 3.2; }
    const bp = (t - this.blinkAt) / (this.dbl ? .4 : .22);
    const lid = bp > 0 && bp < 1 ? (this.dbl ? Math.max(bell(bp / .46), bell((bp - .53) / .46)) : bell(bp)) : 0;

    const lift = a.ty + breath + nod * .5 - a.amp * (speaking ? 1.2 : 0);
    E.body.style.transform = 'translateY(' + lift.toFixed(2) + 'px) rotate(' + (a.lean + bob * .5).toFixed(2) + 'deg) scale(' + (a.sc + a.amp * (speaking ? .006 : .004)).toFixed(4) + ')';

    // skewX + scaleY about the seam line keep the ear cut edge pinned — a rotate() here
    // visibly splits the skull, so don't swap it for one.
    const tw = a.ear * (2.6 + Math.sin(t * 2.4) * 1.2) + (M === 'listening' ? a.amp * 3.6 : 0) + ask * 2.6;
    E.ears.style.transform = 'skewX(' + (-tw).toFixed(2) + 'deg) scaleY(' + (1 + Math.abs(tw) * .012).toFixed(4) + ')';

    const eyeT = 'translate(' + (a.gx * 3).toFixed(2) + 'px,' + (a.gy * 3.2).toFixed(2) + 'px) scale(' + a.eyeSX.toFixed(3) + ',' + clamp(a.eyeSY * (1 - lid * .95), .02, 1.3).toFixed(3) + ')';
    E.pupils.forEach((el) => { el.style.transform = eyeT; });
    E.lids.style.opacity = clamp((lid - .42) / .5, 0, 1).toFixed(3);
    E.brows.style.opacity = (clamp(a.brow, 0, 1.3) * .55).toFixed(3);
    E.brows.style.transform = 'translateY(' + (-a.brow * 1.6).toFixed(2) + 'px)';

    E.mo.setAttribute('ry', (.8 + a.open * 4.4).toFixed(2));
    E.mo.setAttribute('rx', (3.1 + (1 - a.wide) * 1.6 + a.open * 1.1 - ask * .6).toFixed(2));
    E.mo.setAttribute('opacity', clamp(a.open * 2.4, 0, 1).toFixed(3));
    E.mouth.setAttribute('d', 'M27 101 Q34 ' + (101 + a.smile).toFixed(2) + ' 41 101');
    E.mouth.setAttribute('opacity', (1 - clamp(a.open * 1.9, 0, 1)).toFixed(3));

    E.rings.forEach((el, i) => {
      const ph = ((t / 1.5) + i * .34) % 1;
      el.style.opacity = (a.ring * amp * clamp(.5 + a.amp * 1.2, 0, 1) * (1 - ph * .78)).toFixed(3);
      el.style.transform = 'scale(' + (.72 + ph * .42).toFixed(3) + ')';
    });
    E.glow.style.opacity = (a.glow + a.amp * .28).toFixed(3);
    E.shadow.style.opacity = (.9 - lift * .012).toFixed(3);
    E.shadow.style.transform = 'scaleX(' + (1 - lift * .006).toFixed(3) + ')';

    const think = M === 'thinking' ? 1 : 0;
    E.dots.style.opacity = think;
    if (think) E.dot.forEach((d, i) => {
      const b = bell(clamp((((pt / .62) - i * .18) % 1) / .5, 0, 1));
      d.style.transform = 'translateY(' + (-b * 7).toFixed(2) + 'px) scale(' + (.72 + b * .4).toFixed(3) + ')';
    });

    const qv = clamp(ask * 1.6, 0, 1);
    E.q.style.opacity = qv.toFixed(3);
    E.q.style.transform = 'translateY(' + ((1 - qv) * 16).toFixed(2) + 'px) rotate(' + (-8 + qv * 8 + Math.sin(t * 2.6) * 3 * qv).toFixed(2) + 'deg) scale(' + (.6 + qv * .4).toFixed(3) + ')';

    const wp = (t / 1.1) % 1;
    E.wave.style.opacity = ((M === 'listening' ? 1 : 0) * (.55 + a.amp * .45) * (1 - wp * .7)).toFixed(3);
    E.wave.style.transform = 'translateX(' + (-wp * 10).toFixed(2) + 'px) scale(' + (.7 + wp * .35).toFixed(3) + ')';
  }
}

customElements.define('mascot-voice', MascotVoice);
export { MascotVoice, POSE, ACCENT, utterance };
