/**
 * VoiceMascot — listening / thinking / speaking / asking rig.
 * React 17/18, no dependencies. Pairs with hi-body.png (123x202 sprite).
 *
 *   <VoiceMascot state="speaking" text="Here's what I found." amplitude={level} />
 *
 * Drive it from your STT/TTS layer:
 *   - state      : 'idle' | 'listening' | 'thinking' | 'speaking' | 'asking'
 *   - text       : transcript (listening) or the line being spoken (speaking/asking)
 *   - amplitude  : live 0..1 level from an AnalyserNode. Pass null/undefined and the
 *                  rig synthesises a plausible envelope from `text` instead.
 */
const React = window.React;

const SPRITE = { w: 123, h: 202 };
const SEAM = 65; // y where the ears layer is cut from the body layer

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const bell = (p) => (p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI));

const POSE = {
  idle:      { lean: 0,   bodyY: 0,  ear: 0,   eyeSY: 1,    eyeSX: 1,    gazeX: 0,    gazeY: 0,    brow: 0,   glow: 0.24, ring: 0,   scale: 1 },
  listening: { lean: 3.4, bodyY: -3, ear: 1,   eyeSY: 1.09, eyeSX: 1.05, gazeX: 0,    gazeY: 0.28, brow: 0.22,glow: 0.5,  ring: 1,   scale: 1.015 },
  thinking:  { lean: -8,  bodyY: 1,  ear: -0.5,eyeSY: 0.78, eyeSX: 0.97, gazeX: -0.75,gazeY: -0.7, brow: 0.45,glow: 0.3,  ring: 0,   scale: 1 },
  speaking:  { lean: -1,  bodyY: -1, ear: 0.3, eyeSY: 1,    eyeSX: 1,    gazeX: 0,    gazeY: 0,    brow: 0.12,glow: 0.42, ring: 0.4, scale: 1.005 },
  asking:    { lean: -3,  bodyY: -4, ear: 0.8, eyeSY: 1.12, eyeSX: 1.05, gazeX: 0,    gazeY: -0.14,brow: 0.95,glow: 0.46, ring: 0.3, scale: 1.02 }
};

const LABEL  = { idle: 'Idle', listening: 'Listening to you', thinking: 'Thinking', speaking: 'Speaking', asking: 'Asking you' };
const ACCENT = { idle: '#a98fdc', listening: '#35b083', thinking: '#dd9c33', speaking: '#7b52c9', asking: '#c25ba2' };

/** Fake a speech envelope from text when no analyser is connected. */
function utterance(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const syl = [];
  let t = 200, seed = words.length * 7 + String(text || '').length;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  words.forEach((w) => {
    const letters = w.replace(/[^A-Za-z\u2019']/g, '');
    const n = Math.max(1, Math.round(letters.length / 2.7));
    for (let i = 0; i < n; i++) {
      const d = 140 + rnd() * 120;               // syllable length  (raise to slow speech)
      syl.push({ t0: t, d, peak: 0.42 + rnd() * 0.58, wide: rnd() });
      t += d + 22 + rnd() * 34;                  // gap between syllables
    }
    t += /[,.\u2014;:?!]$/.test(w) ? 280 : 80;   // punctuation / word pause
  });
  return { syl, dur: t + 340 };
}

class VoiceMascot extends React.Component {
  constructor(props) {
    super(props);
    this.r = {};
    ['body','ears','pupilL','pupilR','lids','brows','mouth','mouthO','ring1','ring2','ring3',
     'glow','floor','dots','dot1','dot2','dot3','qmark','earwave','bars','statusDot','statusText','caption']
      .forEach((n) => { this.r[n] = React.createRef(); });

    this.v = Object.assign({}, POSE.idle);
    this.st = props.state || 'idle';
    this.text = props.text || '';
    this.utt = this.st === 'speaking' || this.st === 'asking' ? utterance(this.text) : null;
    this.shown = this.utt ? 0 : this.text.length;
    this.T = 0; this.sT = 0; this.last = 0;
    this.amp = 0; this.extAmp = -1; this.extAt = 0;
    this.gx = 0; this.gy = 0;
    this.blinkAt = 2400; this.blinkT = -1; this.double = false;
    this.barEls = []; this.lastCap = null; this.lastLabel = null;
  }

  componentDidMount() {
    if (this.r.bars.current) {
      for (let i = 0; i < 20; i++) {
        const b = document.createElement('div');
        b.style.cssText = 'width:3.5px;height:5px;border-radius:2px;background:#7b52c9';
        this.r.bars.current.appendChild(b); this.barEls.push(b);
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  }
  componentWillUnmount() { cancelAnimationFrame(this.raf); }

  componentDidUpdate(prev) {
    const s = this.props.state || 'idle';
    if (s !== prev.state || this.props.text !== prev.text) this.go(s, this.props.text || '');
  }

  /** Imperative escape hatch: ref.current.setState_('speaking', 'text') */
  setState_(s, text) { this.go(s, text == null ? '' : text); }
  setAmplitude(v) { this.extAmp = clamp(Number(v) || 0, 0, 1); this.extAt = performance.now(); }

  go(s, text) {
    this.st = s; this.sT = 0;
    const speaks = s === 'speaking' || s === 'asking';
    this.text = text || '';
    this.utt = speaks ? utterance(this.text) : null;
    this.shown = speaks ? 0 : this.text.length;
    if (this.props.onStateEnter) this.props.onStateEnter(s);
  }

  gazeTarget() {
    if (this.st === 'thinking') return [-0.72 + Math.sin(this.sT / 900) * 0.18, -0.66 + Math.sin(this.sT / 1300) * 0.12];
    if (this.st === 'listening') return [Math.sin(this.T / 2100) * 0.1, 0.26];
    if (this.st === 'asking')    return [Math.sin(this.T / 1700) * 0.07, -0.16];
    if (this.st === 'speaking')  return [Math.sin(this.T / 1500) * 0.13, Math.sin(this.T / 2400) * 0.1];
    return [Math.sin(this.T / 2600) * 0.18, Math.sin(this.T / 3300) * 0.12];
  }

  envelope(t) {
    const u = this.utt; if (!u) return 0;
    let v = 0;
    for (let i = 0; i < u.syl.length; i++) {
      const s = u.syl[i];
      if (t < s.t0 - 40) break;
      if (t > s.t0 + s.d) continue;
      v = Math.max(v, bell((t - s.t0) / s.d) * s.peak);
    }
    return v;
  }
  currentSyl(t) {
    const u = this.utt; if (!u) return null;
    for (let i = 0; i < u.syl.length; i++) { const s = u.syl[i]; if (t >= s.t0 && t <= s.t0 + s.d) return s; }
    return null;
  }

  loop = (now) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(48, this.last ? now - this.last : 16);
    this.last = now; this.T += dt; this.sT += dt;

    if (this.props.amplitude != null) this.setAmplitude(this.props.amplitude);

    const target = POSE[this.st] || POSE.idle;
    const k = clamp(dt / 190, 0, 1);
    for (const p in target) this.v[p] += (target[p] - this.v[p]) * k;

    let a = 0;
    if (this.extAmp >= 0 && now - this.extAt < 400) a = this.extAmp;
    else if (this.utt) a = this.envelope(this.sT);
    else if (this.st === 'listening')
      a = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(this.T / 260)) * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.T / 730)));
    this.amp += (a - this.amp) * clamp(dt / (a > this.amp ? 55 : 130), 0, 1);

    const gt = this.gazeTarget();
    const gk = clamp(dt / (this.st === 'thinking' ? 340 : 200), 0, 1);
    this.gx += (gt[0] - this.gx) * gk;
    this.gy += (gt[1] - this.gy) * gk;

    let lid = 0;
    if (this.T > this.blinkAt && this.blinkT < 0) { this.blinkT = 0; this.double = Math.random() < 0.2; }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const dur = this.double ? 400 : 220;
      const p = this.blinkT / dur;
      lid = this.double ? Math.max(bell(p / 0.46), bell((p - 0.53) / 0.46)) : bell(p);
      if (this.blinkT > dur) { this.blinkT = -1; this.blinkAt = this.T + (this.st === 'listening' ? 3600 : 2500) + Math.random() * 3200; }
    }

    if (this.utt) this.shown = Math.round(clamp((this.sT - 120) / Math.max(1, this.utt.dur - 400), 0, 1) * this.text.length);
    this.apply(lid);
  };

  apply(lid) {
    const r = this.r, v = this.v, amp = this.amp, T = this.T;
    const body = r.body.current; if (!body) return;
    const speaking = this.st === 'speaking' || this.st === 'asking';
    const asking = this.st === 'asking';
    const askRise = asking && this.utt ? clamp((this.sT - this.utt.dur * 0.62) / (this.utt.dur * 0.38), 0, 1) : 0;

    const breath = Math.sin(T / 3100) * 1.1;
    const bob = speaking ? Math.sin(T / 215) * 1.4 * amp : 0;
    const nod = this.st === 'listening' ? -amp * 4.2 : 0;
    const lean = v.lean + bob * 0.5 - askRise * 5;
    const ty = v.bodyY + breath + nod * 0.5 - askRise * 3 - amp * (speaking ? 1.2 : 0);
    const sc = v.scale + askRise * 0.012 + amp * (speaking ? 0.006 : 0.004);
    body.style.transform = 'translateY(' + ty.toFixed(2) + 'px) rotate(' + lean.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';

    // skewX + scaleY about the clip seam keep the ear cut-line pinned — no visible split
    if (r.ears.current) {
      const tw = v.ear * (2.6 + Math.sin(T / 420) * 1.2) + (this.st === 'listening' ? amp * 3.6 : 0) + askRise * 2.6;
      r.ears.current.style.transform = 'skewX(' + (-tw).toFixed(2) + 'deg) scaleY(' + (1 + Math.abs(tw) * 0.012).toFixed(4) + ')';
    }

    const eyeSY = v.eyeSY * (1 - lid * 0.95) + askRise * 0.1;
    const eyeSX = v.eyeSX + askRise * 0.04;
    if (r.pupilL.current) r.pupilL.current.style.transform = 'translate(' + (this.gx * 2.4).toFixed(2) + 'px,' + (this.gy * 3).toFixed(2) + 'px) scale(' + eyeSX.toFixed(3) + ',' + Math.max(0.02, eyeSY).toFixed(3) + ')';
    if (r.pupilR.current) r.pupilR.current.style.transform = 'translate(' + (this.gx * 3).toFixed(2) + 'px,' + (this.gy * 3.4).toFixed(2) + 'px) scale(' + eyeSX.toFixed(3) + ',' + Math.max(0.02, eyeSY).toFixed(3) + ')';
    if (r.lids.current) r.lids.current.style.opacity = clamp((lid - 0.42) / 0.5, 0, 1).toFixed(3);

    if (r.brows.current) {
      const b = clamp(v.brow + askRise * 0.5, 0, 1.3);
      r.brows.current.style.opacity = (b * 0.55).toFixed(3);
      r.brows.current.style.transform = 'translateY(' + (-b * 1.6).toFixed(2) + 'px)';
    }

    if (r.mouthO.current && r.mouth.current) {
      let open = 0, wide = 0;
      if (speaking) {
        const s = this.currentSyl(this.sT);
        wide = s ? s.wide : 0.4;
        open = clamp(amp * 1.25, 0, 1);
        if (askRise > 0.55) open = Math.max(open, 0.5 * askRise);
      }
      r.mouthO.current.setAttribute('ry', (0.8 + open * 4.4).toFixed(2));
      r.mouthO.current.setAttribute('rx', (3.1 + (1 - wide) * 1.6 + open * 1.1 - askRise * 0.6).toFixed(2));
      r.mouthO.current.setAttribute('opacity', clamp(open * 2.4, 0, 1).toFixed(3));
      const smile = speaking ? 1.6 : this.st === 'thinking' ? -0.6 : this.st === 'listening' ? 3.4 : 3.8;
      r.mouth.current.setAttribute('d', 'M27 101 Q34 ' + (101 + smile).toFixed(2) + ' 41 101');
      r.mouth.current.setAttribute('opacity', (1 - clamp(open * 1.9, 0, 1)).toFixed(3));
    }

    const rings = [r.ring1.current, r.ring2.current, r.ring3.current];
    for (let i = 0; i < 3; i++) {
      const el = rings[i]; if (!el) continue;
      const ph = ((T / 1500) + i * 0.34) % 1;
      const lvl = clamp(0.5 + amp * 1.2, 0, 1);
      el.style.opacity = (v.ring * lvl * (1 - ph * 0.78)).toFixed(3);
      el.style.transform = 'scale(' + (0.72 + ph * 0.42).toFixed(3) + ')';
    }
    if (r.glow.current) r.glow.current.style.opacity = (v.glow + amp * 0.28).toFixed(3);
    if (r.floor.current) r.floor.current.style.transform = 'scaleX(' + (1 - ty * 0.006).toFixed(3) + ')';

    if (r.dots.current) {
      const on = this.st === 'thinking' ? 1 : 0;
      r.dots.current.style.opacity = on;
      if (on) [r.dot1.current, r.dot2.current, r.dot3.current].forEach((d, i) => {
        if (!d) return;
        const p = ((this.sT / 620) - i * 0.18) % 1;
        const b = bell(clamp(p / 0.5, 0, 1));
        d.style.transform = 'translateY(' + (-b * 7).toFixed(2) + 'px) scale(' + (0.72 + b * 0.4).toFixed(3) + ')';
      });
    }
    if (r.qmark.current) {
      const q = asking ? clamp(askRise * 1.6, 0, 1) : 0;
      r.qmark.current.style.opacity = q.toFixed(3);
      r.qmark.current.style.transform = 'translateY(' + ((1 - q) * 16).toFixed(2) + 'px) rotate(' + (-8 + q * 8 + Math.sin(T / 380) * 3 * q).toFixed(2) + 'deg) scale(' + (0.6 + q * 0.4).toFixed(3) + ')';
    }
    if (r.earwave.current) {
      const on = this.st === 'listening' ? 1 : 0;
      const p = (T / 1100) % 1;
      r.earwave.current.style.opacity = (on * (0.55 + amp * 0.45) * (1 - p * 0.7)).toFixed(3);
      r.earwave.current.style.transform = 'translateX(' + (-p * 10).toFixed(2) + 'px) scale(' + (0.7 + p * 0.35).toFixed(3) + ')';
    }

    for (let i = 0; i < this.barEls.length; i++) {
      const c = Math.abs(i - (this.barEls.length - 1) / 2) / ((this.barEls.length - 1) / 2);
      const shape = 1 - c * c * 0.85;
      const wob = 0.55 + 0.45 * Math.sin(T / (170 + i * 21) + i);
      const live = this.st === 'idle' ? 0.04 : amp;
      this.barEls[i].style.height = (4 + live * 30 * shape * wob).toFixed(1) + 'px';
      this.barEls[i].style.opacity = (this.st === 'idle' ? 0.3 : 0.55 + live * 0.45).toFixed(2);
      this.barEls[i].style.background = this.st === 'idle' ? 'rgba(123,82,201,.5)' : '#7b52c9';
    }

    const label = LABEL[this.st];
    if (label !== this.lastLabel) {
      this.lastLabel = label;
      if (r.statusText.current) r.statusText.current.textContent = label;
      if (r.statusDot.current) r.statusDot.current.style.background = ACCENT[this.st];
    }
    if (r.statusDot.current) r.statusDot.current.style.transform = 'scale(' + (1 + (this.st === 'listening' || speaking ? amp * 0.7 : 0)).toFixed(3) + ')';

    const raw = this.utt ? this.text.slice(0, this.shown) : this.st === 'thinking' ? '' : this.text;
    const cap = this.st === 'listening' && raw ? '\u201C' + raw + '\u201D' : raw;
    if (cap !== this.lastCap) {
      this.lastCap = cap;
      if (r.caption.current) {
        r.caption.current.textContent = cap;
        r.caption.current.style.color = this.st === 'listening' ? '#6a5a8c' : '#33255c';
        r.caption.current.style.fontWeight = this.st === 'listening' ? '500' : '600';
      }
    }
  }

  render() {
    const s = this.props.scale == null ? 1.9 : this.props.scale;
    const W = SPRITE.w * s, H = SPRITE.h * s;
    const src = this.props.spriteSrc || 'hi-body.png';
    const showAura = this.props.showAura !== false;
    const showCaption = this.props.showCaption !== false;
    const showMeter = this.props.showMeter !== false;
    const h = React.createElement;

    const eye = (socketRef, pupilRef, L, T2, SW, SH, PL, PT, PW, PH) =>
      h('div', { ref: socketRef, style: { position: 'absolute', left: L, top: T2, width: SW, height: SH, borderRadius: '50%', background: 'linear-gradient(180deg,#faf1fc 0%,#f6ecfa 55%,#efe1f7 100%)', overflow: 'hidden' } },
        h('div', { ref: pupilRef, style: { position: 'absolute', left: PL, top: PT, width: PW, height: PH, transformOrigin: '50% 50%' } },
          h('div', { style: { position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(178deg,#1d1540 0%,#0b0719 46%,#3c2b66 80%,#a37ccf 100%)' } },
            h('div', { style: { position: 'absolute', left: '16%', top: '11%', width: '40%', height: '24%', borderRadius: '50%', background: '#fff', opacity: 0.97 } }),
            h('div', { style: { position: 'absolute', left: '50%', top: '68%', width: '28%', height: '16%', borderRadius: '50%', background: '#e7d8ff', opacity: 0.38 } })
          )));

    return h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" } },

      h('div', { style: { position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%' } },

        showAura && h('div', { style: { position: 'absolute', left: '50%', bottom: 16, width: 560, height: 560, marginLeft: -280, pointerEvents: 'none' } },
          h('div', { ref: this.r.ring3, style: { position: 'absolute', left: '50%', top: '50%', width: 500, height: 500, margin: '-250px 0 0 -250px', borderRadius: '50%', border: '1.5px solid rgba(107,66,183,.55)', opacity: 0 } }),
          h('div', { ref: this.r.ring2, style: { position: 'absolute', left: '50%', top: '50%', width: 400, height: 400, margin: '-200px 0 0 -200px', borderRadius: '50%', border: '1.5px solid rgba(107,66,183,.7)', opacity: 0 } }),
          h('div', { ref: this.r.ring1, style: { position: 'absolute', left: '50%', top: '50%', width: 306, height: 306, margin: '-153px 0 0 -153px', borderRadius: '50%', border: '1.75px solid rgba(107,66,183,.85)', opacity: 0 } }),
          h('div', { ref: this.r.glow, style: { position: 'absolute', left: '50%', top: '50%', width: 440, height: 440, margin: '-220px 0 0 -220px', borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(255,255,255,.9),rgba(255,255,255,0) 70%)', opacity: 0.24 } })
        ),

        h('div', { ref: this.r.floor, style: { position: 'absolute', left: '50%', bottom: 8, width: 230, height: 30, marginLeft: -115, borderRadius: '50%', background: 'radial-gradient(closest-side,rgba(84,48,142,.32),rgba(84,48,142,0))', pointerEvents: 'none' } }),

        h('div', { style: { position: 'relative', width: W, height: H, marginBottom: 14 } },

          h('div', { style: { position: 'absolute', left: 0, top: 0, width: SPRITE.w, height: SPRITE.h, transformOrigin: '0 0', transform: 'scale(' + s + ')' } },
            h('div', { ref: this.r.body, style: { position: 'absolute', left: 0, top: 0, width: SPRITE.w, height: SPRITE.h, transformOrigin: '47% 96%', filter: 'saturate(1.08) drop-shadow(0 14px 20px rgba(74,44,128,.22))' } },
              h('img', { ref: this.r.ears, src, alt: '', style: { position: 'absolute', left: 0, top: 0, width: SPRITE.w, height: SPRITE.h, clipPath: 'inset(0 0 ' + (SPRITE.h - SEAM - 2) + 'px 0)', transformOrigin: '61px ' + SEAM + 'px' } }),
              h('img', { src, alt: 'Mascot listening and speaking', style: { position: 'absolute', left: 0, top: 0, width: SPRITE.w, height: SPRITE.h, clipPath: 'inset(' + SEAM + 'px 0 0 0)' } }),

              eye(null, this.r.pupilL, 3.5, 71, 20, 38, 3, 5, 14, 28),
              eye(null, this.r.pupilR, 45.5, 69, 28, 41, 3.5, 5, 21, 31),

              h('svg', { ref: this.r.lids, viewBox: '0 0 123 202', style: { position: 'absolute', left: 0, top: 0, width: SPRITE.w, height: SPRITE.h, opacity: 0, pointerEvents: 'none' } },
                h('path', { d: 'M5 91 Q13.5 86.5 22 91', fill: 'none', stroke: '#3a2a63', strokeWidth: 1.9, strokeLinecap: 'round' }),
                h('path', { d: 'M47.5 90 Q59.5 85 71.5 90', fill: 'none', stroke: '#3a2a63', strokeWidth: 1.9, strokeLinecap: 'round' })),

              h('svg', { ref: this.r.brows, viewBox: '0 0 123 202', style: { position: 'absolute', left: 0, top: 0, width: SPRITE.w, height: SPRITE.h, opacity: 0, pointerEvents: 'none' } },
                h('path', { d: 'M5 66 Q13.5 62.5 22 66', fill: 'none', stroke: '#8c6fc2', strokeWidth: 1.7, strokeLinecap: 'round' }),
                h('path', { d: 'M47.5 64 Q59.5 60 71.5 64', fill: 'none', stroke: '#8c6fc2', strokeWidth: 1.7, strokeLinecap: 'round' })),

              h('div', { style: { position: 'absolute', left: 23, top: 95.5, width: 23, height: 14, borderRadius: 7, background: 'linear-gradient(180deg,#f9f0fc 0%,#f5ebfa 60%,#f1e4f8 100%)' } }),
              h('svg', { viewBox: '0 0 123 202', style: { position: 'absolute', left: 0, top: 0, width: SPRITE.w, height: SPRITE.h, pointerEvents: 'none' } },
                h('ellipse', { ref: this.r.mouthO, cx: 34, cy: 103, rx: 4, ry: 1, fill: '#3d2c63', opacity: 0 }),
                h('path', { ref: this.r.mouth, d: 'M27 101 Q34 105 41 101', fill: 'none', stroke: '#5b4489', strokeWidth: 1.5, strokeLinecap: 'round' }))
            )),

          h('div', { ref: this.r.dots, style: { position: 'absolute', left: W * 0.64, top: 2, display: 'flex', gap: 7, opacity: 0, pointerEvents: 'none' } },
            h('div', { ref: this.r.dot1, style: { width: 10, height: 10, borderRadius: '50%', background: '#dd9c33', boxShadow: '0 4px 10px -4px rgba(74,44,128,.55)' } }),
            h('div', { ref: this.r.dot2, style: { width: 10, height: 10, borderRadius: '50%', background: '#dd9c33', boxShadow: '0 4px 10px -4px rgba(74,44,128,.55)' } }),
            h('div', { ref: this.r.dot3, style: { width: 10, height: 10, borderRadius: '50%', background: '#dd9c33', boxShadow: '0 4px 10px -4px rgba(74,44,128,.55)' } })),

          h('div', { ref: this.r.qmark, style: { position: 'absolute', left: W * 0.64, top: -30, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50% 50% 50% 8px', background: '#fff', boxShadow: '0 14px 26px -12px rgba(74,44,128,.6),0 0 0 1px rgba(151,116,206,.16)', fontSize: 32, lineHeight: 1, fontWeight: 800, color: '#c25ba2', opacity: 0, pointerEvents: 'none', transformOrigin: '20% 90%' } }, '?'),

          h('div', { ref: this.r.earwave, style: { position: 'absolute', left: -38, top: 44, width: 52, height: 52, opacity: 0, pointerEvents: 'none' } },
            h('div', { style: { position: 'absolute', inset: 0, borderRadius: '50%', border: '2.75px solid #35b083', borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: 'rotate(-45deg)' } }),
            h('div', { style: { position: 'absolute', left: 13, top: 13, right: 13, bottom: 13, borderRadius: '50%', border: '2.75px solid rgba(53,176,131,.8)', borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: 'rotate(-45deg)' } }))
        )
      ),

      showCaption && h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 680, minHeight: 110 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 15px 7px 11px', borderRadius: 999, background: 'rgba(255,255,255,.8)', boxShadow: '0 6px 16px -10px rgba(74,44,128,.6)', fontSize: 12.5, fontWeight: 700, color: '#6a4fa3' } },
          h('div', { ref: this.r.statusDot, style: { width: 8, height: 8, borderRadius: '50%', background: '#a98fdc' } }),
          h('span', { ref: this.r.statusText }, 'Idle')),
        h('div', { ref: this.r.caption, style: { fontSize: 20, lineHeight: 1.45, fontWeight: 600, letterSpacing: '-.012em', textAlign: 'center', color: '#33255c', textWrap: 'pretty', minHeight: 58 } })),

      showMeter && h('div', { ref: this.r.bars, style: { display: 'flex', alignItems: 'center', gap: 3.5, height: 36 } })
    );
  }
}

if (typeof module !== 'undefined') module.exports = { VoiceMascot };
if (typeof window !== 'undefined') window.VoiceMascot = VoiceMascot;
