/**
 * <mascot-companion> — a login-page companion mascot that reacts to the form.
 * Dependency-free custom element. Assets: base.png (face erased), arm.png (hinged paw).
 *
 *   <script type="module" src="/mascot-companion/mascot-companion.js"></script>
 *   <mascot-companion size="300" state="idle" assets="/mascot-companion/"></mascot-companion>
 *
 * Drive it from your form:
 *   el.state = 'email' | 'typing' | 'password' | 'hover' | 'submit' | 'success' | 'error' | 'idle'
 *   el.blink()  — force a blink
 *
 * 'success' and 'error' are timed beats: they play out and settle back to 'idle' on their own,
 * firing a 'settled' event when they do. Everything else holds until you change it.
 * Honors prefers-reduced-motion (drops the float and hop, keeps gaze and expression).
 */

const S = 2.7;                     // sprite art is 123x202; everything below is art px x S
const BOX = { w: 332, h: 546 };
const PIVOT = '166px 546px';       // body rotates about the feet
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
const ease = (t) => t * t * (3 - 2 * t);
const arcE = (t) => Math.sin(Math.PI * clamp(t, 0, 1));

// One pose per state. Springs supply all easing, lag and overlap.
// fx/fy shift the face (the head-turn read), gx/gy aim the eyes, rot leans the body.
// Positive x = toward the form. mouth: 0 smile, 1 open smile, 2 curious.
const POSE = {
  idle:     { rot: 0, fx: 0, fy: 0, gx: 0, gy: 0, open: 1, arc: 0, wide: 0, mouth: 0 },
  email:    { rot: 2.4, fx: 5, fy: 1, gx: 4, gy: 3.5, open: 1, arc: 0, wide: 0, mouth: 0 },
  typing:   { rot: 2.4, fx: 5, fy: 1, gx: 4, gy: 3.5, open: 1, arc: 0, wide: 0, mouth: 0 },
  password: { rot: -3, fx: -7, fy: -1.5, gx: -4, gy: -2, open: 1, arc: 1, wide: 0, mouth: 0 },
  hover:    { rot: 3.6, fx: 4, fy: 2, gx: 3, gy: 2, open: 1, arc: 0, wide: .3, mouth: 0 },
  submit:   { rot: 1.4, fx: 1, fy: -1, gx: 0, gy: -1, open: 1.14, arc: 0, wide: 1, mouth: 1 },
  success:  { rot: 0, fx: 0, fy: -1, gx: 0, gy: 0, open: 1, arc: 1, wide: 1, mouth: 1 },
  error:    { rot: -3.6, fx: 2, fy: 0, gx: 2, gy: 1.5, open: 1.07, arc: 0, wide: .5, mouth: 2 },
};
const BEATS = { success: 1900, error: 1400 };   // ms, then back to idle

const EYE = 'linear-gradient(178deg,#1a1338 0%,#0a0718 42%,#3a2a63 76%,#9d75cb 100%)';
const SPARK = 'polygon(50% 0,58% 42%,100% 50%,58% 58%,50% 100%,42% 58%,0 50%,42% 42%)';

class MascotCompanion extends HTMLElement {
  static observedAttributes = ['size', 'state', 'assets', 'motion'];

  get state() { return this.getAttribute('state') || 'idle'; }
  set state(v) { this.setAttribute('state', v || 'idle'); }

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this.a = { rot: 0, fx: 0, fy: 0, gx: 0, gy: 0, arc: 0, wide: 0, arm: 0, lift: 0, aura: 0, m0: 1, m1: 0, m2: 0 };
    this.v = {};
    this.burst = 0; this.blinkAt = -9; this.blinkNext = 2.2; this.phaseAt = performance.now() / 1000;
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.#build();
    this.#size();
    const loop = () => { if (!this.isConnected) return; this.last = performance.now() / 1000; this.#tick(this.last); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    // keeps the companion alive if rAF is throttled (background tab, hidden frame)
    this.iv = setInterval(() => { const t = performance.now() / 1000; if (t - (this.last || 0) > .12) this.#tick(t); }, 33);
  }

  disconnectedCallback() { cancelAnimationFrame(this.raf); clearInterval(this.iv); clearTimeout(this.beat); }

  attributeChangedCallback(name, was, now) {
    if (!this.shadowRoot || was === now) return;
    if (name === 'size') return this.#size();
    if (name === 'assets') { this.#build(); return this.#size(); }
    if (name === 'state') {
      this.phaseAt = performance.now() / 1000;
      clearTimeout(this.beat);
      const ms = BEATS[now];
      if (ms) this.beat = setTimeout(() => {
        if (this.state === now) { this.state = 'idle'; this.dispatchEvent(new CustomEvent('settled', { detail: now })); }
      }, ms);
    }
  }

  blink() { this.blinkAt = performance.now() / 1000; }

  #build() {
    const base = this.getAttribute('assets') || './';
    const eye = (w, h, left, top, vb, path, sw) => `
      <div data-box style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px">
        <div data-eye style="position:absolute;inset:0;border-radius:50%;background:${EYE};transform-origin:50% 50%">
          <div style="position:absolute;left:15%;top:11%;width:35%;height:23%;border-radius:50%;background:#fff;opacity:.95"></div>
          <div style="position:absolute;left:53%;top:67%;width:25%;height:16%;border-radius:50%;background:#e7d8ff;opacity:.4"></div>
        </div>
        <svg data-arc viewBox="${vb}" style="position:absolute;inset:0;width:100%;height:100%;opacity:0"><path d="${path}" fill="none" stroke="#241a48" stroke-width="${sw}" stroke-linecap="round"></path></svg>
      </div>`;
    this.shadowRoot.innerHTML = `
      <style>:host{display:inline-block;position:relative;overflow:visible;line-height:0}</style>
      <div data-stage style="position:absolute;left:0;top:0;width:${BOX.w}px;height:${BOX.h}px;transform-origin:50% 100%">
        <div data-aura style="position:absolute;left:50%;top:46%;width:600px;height:600px;margin:-300px 0 0 -300px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.92),rgba(233,222,252,.42) 52%,rgba(233,222,252,0) 74%);opacity:.6"></div>
        <div data-shadow style="position:absolute;left:50%;top:534px;width:240px;height:36px;margin-left:-120px;border-radius:50%;background:radial-gradient(closest-side,rgba(69,38,124,.62),rgba(69,38,124,0))"></div>
        <div data-float style="position:absolute;inset:0">
          <div data-body style="position:absolute;inset:0;transform-origin:${PIVOT};filter:saturate(1.22) contrast(1.05) drop-shadow(0 16px 26px rgba(74,44,128,.3))">
            <img data-arm src="${base}arm.png" alt="" style="position:absolute;left:0;top:318.6px;width:81px;height:172.8px;transform-origin:64.8px 24.3px;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges">
            <img src="${base}base.png" alt="Companion mascot" style="position:absolute;left:0;top:0;width:332.1px;height:545.4px;image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges">
            <div data-feats style="position:absolute;inset:0">
              ${eye(32.4, 70.2, 20.25, 203.85, '0 0 12 26', 'M1.4 15.4 Q6 8.4 10.6 15.4', 2.3)}
              ${eye(54, 75.6, 133.65, 201.15, '0 0 20 28', 'M2 16.4 Q10 7.6 18 16.4', 2.5)}
              <svg viewBox="0 0 16 12" style="position:absolute;left:70.2px;top:261.9px;width:43.2px;height:32.4px;overflow:visible">
                <path data-m0 d="M1.2 4.1 Q8 9.7 14.8 3.7" fill="none" stroke="#bda7d6" stroke-width="1.5" stroke-linecap="round"></path>
                <path data-m1 d="M1.4 3.5 Q8 11.6 14.6 3.1 Q8 6.3 1.4 3.5 Z" fill="#a07dc6" opacity="0"></path>
                <ellipse data-m2 cx="8" cy="5.6" rx="1.9" ry="2.4" fill="#ab8bce" opacity="0"></ellipse>
              </svg>
            </div>
          </div>
        </div>
        <div data-burst style="position:absolute;left:50%;top:40%;width:0;height:0">
          ${('<div style="position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;background:radial-gradient(closest-side,#fff,#c4a8f0);clip-path:' + SPARK + ';opacity:0"></div>').repeat(6)}
        </div>
      </div>`;
    const q = (s) => this.shadowRoot.querySelector(s);
    const boxes = this.shadowRoot.querySelectorAll('[data-box]');
    this.el = {
      stage: q('[data-stage]'), float: q('[data-float]'), body: q('[data-body]'), arm: q('[data-arm]'),
      feats: q('[data-feats]'), aura: q('[data-aura]'), shadow: q('[data-shadow]'), burst: q('[data-burst]'),
      m0: q('[data-m0]'), m1: q('[data-m1]'), m2: q('[data-m2]'),
      boxes, eyes: this.shadowRoot.querySelectorAll('[data-eye]'), arcs: this.shadowRoot.querySelectorAll('[data-arc]'),
    };
  }

  #size() {
    const size = parseFloat(this.getAttribute('size') || 300);
    const k = size / BOX.w;
    this.style.width = size + 'px';
    this.style.height = BOX.h * k + 'px';
    this.el.stage.style.transform = 'scale(' + k + ')';
    this.el.stage.style.transformOrigin = '0 0';
  }

  #step(k, target, kp, d) {
    this.v[k] = ((this.v[k] || 0) + (target - this.a[k]) * kp) * d;
    this.a[k] += this.v[k];
  }

  #tick(t) {
    const a = this.a, E = this.el, M = this.state, p = POSE[M] || POSE.idle;
    const amp = this.reduce ? 0 : clamp(parseFloat(this.getAttribute('motion') || 1), 0, 2);
    const pt = t - this.phaseAt;

    const float = Math.sin(t * 2 * Math.PI / 4.6);
    const breath = Math.sin(t * 2 * Math.PI / 3.1);
    const sway = Math.sin(t * 2 * Math.PI / 7.3);

    let hop = 0, armT = 0;
    if (M === 'submit') hop = arcE(seg(pt, 0, .55)) * 26 * amp;
    if (M === 'success') {
      hop = (arcE(seg(pt, .05, .5)) * 30 + arcE(seg(pt, .52, .95)) * 16) * amp;
      const up = ease(seg(pt, .5, .72)) * (1 - ease(seg(pt, 1.5, 1.75)));
      armT = 112 * up + Math.sin(seg(pt, .68, 1.6) * Math.PI * 6) * 15 * up;
    }
    if (M === 'error' && pt < .1 && this.blinkAt < t - .4) this.blinkAt = t;

    const typing = M === 'typing' ? 1 : 0;
    this.#step('rot', p.rot + sway * .5 * amp, .09, .8);
    this.#step('fx', p.fx + typing * Math.sin(t * 9.1) * 1.4 * amp, .12, .78);
    this.#step('fy', p.fy + typing * Math.sin(t * 6.3) * .8 * amp, .13, .76);
    this.#step('gx', p.gx, .16, .74);
    this.#step('gy', p.gy, .16, .74);
    this.#step('arc', p.arc, .14, .72);
    this.#step('wide', p.wide, .1, .8);
    this.#step('arm', armT, .22, .62);
    this.#step('lift', hop, .3, .55);
    this.#step('m0', p.mouth === 0 ? 1 : 0, .18, .7);
    this.#step('m1', p.mouth === 1 ? 1 : 0, .18, .7);
    this.#step('m2', p.mouth === 2 ? 1 : 0, .18, .7);

    if (a.arc < .5 && t > this.blinkNext) { this.blinkAt = t; this.blinkNext = t + 2.4 + Math.random() * 4.2; }
    const bl = seg(t - this.blinkAt, 0, .17);
    const blink = bl > 0 && bl < 1 ? 1 - Math.sin(Math.PI * bl) * .94 : 1;
    const openY = (p.open + a.wide * .06) * blink * (1 - a.arc * .92);

    const bT = M === 'submit' ? arcE(seg(pt, .05, .9)) : M === 'success' ? arcE(seg(pt, .1, 1.7)) : 0;
    this.burst += (bT - this.burst) * .18;

    const lift = a.lift + float * 7 * amp;
    E.float.style.transform = 'translateY(' + (-lift) + 'px)';
    // the rig is mirrored so the mascot faces the form; pose values stay in "toward the form" terms
    E.body.style.transform = 'rotate(' + (-a.rot) + 'deg) scale(' + (-(1 - .007 * breath * amp)) + ',' + (1 + .009 * breath * amp) + ')';
    E.arm.style.transform = 'rotate(' + a.arm + 'deg)';
    E.feats.style.transform = 'translate(' + (-a.fx) + 'px,' + (a.fy + lift * .04) + 'px)';

    const gaze = 'translate(' + (-a.gx) + 'px,' + a.gy + 'px)';
    const eyeT = 'scale(' + (1 + a.wide * .04) + ',' + clamp(openY, .02, 1.2) + ')';
    E.boxes.forEach((b) => { b.style.transform = gaze; });
    E.eyes.forEach((el) => { el.style.transform = eyeT; el.style.opacity = 1 - a.arc; });
    E.arcs.forEach((el) => { el.style.opacity = a.arc; });
    E.m0.style.opacity = a.m0; E.m1.style.opacity = a.m1; E.m2.style.opacity = a.m2;

    E.shadow.style.opacity = .26 - lift * .003;
    E.shadow.style.transform = 'scale(' + (1 - lift * .0045) + ')';
    this.#step('aura', lift, .06, .82);
    E.aura.style.transform = 'translateY(' + (-a.aura * .5) + 'px) scale(' + (1 + a.aura * .0016 + this.burst * .05) + ')';
    E.aura.style.opacity = .5 + this.burst * .3 + Math.abs(float) * .06;

    const kids = E.burst.children;
    for (let i = 0; i < kids.length; i++) {
      const ang = (i / kids.length) * Math.PI * 2 + .6, rad = 74 + 96 * this.burst;
      kids[i].style.transform = 'translate(' + Math.cos(ang) * rad + 'px,' + Math.sin(ang) * rad * .8 + 'px) rotate(' + (i * 30 + this.burst * 60) + 'deg) scale(' + (.5 + this.burst * .7) + ')';
      kids[i].style.opacity = this.burst * .95;
    }
  }
}

customElements.define('mascot-companion', MascotCompanion);
export { MascotCompanion, POSE };
