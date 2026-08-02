"use client";

// PopupPeek.tsx — drop-in mascot layer for any modal.
//
//   <PopupPeek open={isOpen} onClosed={() => unmount()} cardWidth={480}>
//     ...your existing modal content...
//   </PopupPeek>
//
// Owns: scrim, card transform, deformable top edge, the mascot rig, the hands.
// Your content renders inside the card, untouched.
//
// Vendored from design_handoff_popup_peek/PopupPeek.jsx. Ported to TS + Next.js:
//   - "use client" (rAF loop, matchMedia, window listeners)
//   - art plate served from /public rather than import.meta.url
//   - rig re-centres on cards wider than 480px (see rigShift)
//   - gradient ids namespaced with useId so two modals can coexist
//   - the whole stage scales down to fit narrow viewports
//   - the handoff's string-keyed ref map became discrete refs, so nothing
//     touches a ref during render (React Compiler rules in Next 16)
//
// Prefer the <Modal> wrapper in app/components/Modal.tsx over using this
// directly — it owns the "stay mounted until the exit finishes" lifecycle.

import React, { useRef, useEffect, useState, useCallback, useId, useSyncExternalStore } from "react";
import {
  ENTER,
  EXIT,
  CLOSED,
  RIG,
  EXIT_DURATION,
  sample,
  edgePath,
  rigShift,
  type Sampled,
} from "./popup-peek-timeline";

const ART = "/popup-peek/peek-base.png";

type Phase = "closed" | "enter" | "live" | "exit";

// The rig occupies RIG.clip.h (243px) directly above the card's top edge, so the
// card can never sit closer to the viewport top than that plus a little air —
// otherwise the mascot's head is cropped by the window. These drive the layout
// solve in the measure effect below.
const RIG_MARGIN = 22;
const BOTTOM_MARGIN = 28;
/** Preferred resting position, as a fraction of viewport height. */
const PREFERRED_TOP = 0.18;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReduced = () => window.matchMedia(REDUCED_QUERY).matches;

function Paw({
  innerRef,
  mirror,
  gradId,
}: {
  innerRef: React.RefObject<HTMLDivElement | null>;
  mirror?: boolean;
  gradId: string;
}) {
  return (
    <div
      ref={innerRef}
      data-mirror={mirror ? "1" : undefined}
      style={{ width: 44, height: 50, transformOrigin: "50% 100%", transform: mirror ? "scaleX(-1)" : undefined }}
    >
      <svg viewBox="0 0 44 50" width="44" height="50" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id={gradId} x1=".2" y1="0" x2=".55" y2="1">
            <stop offset="0" stopColor="#f6f0fe" />
            <stop offset=".55" stopColor="#e0d1f9" />
            <stop offset="1" stopColor="#c2a8ee" />
          </linearGradient>
        </defs>
        <path d="M4 10 C1 20 2 30 7 36 C12 43 32 43 37 36 C42 30 43 20 40 10 Z" fill={`url(#${gradId})`} stroke="#9878c6" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M11.5 38 a4.6 5 0 0 0 9 0" fill={`url(#${gradId})`} stroke="#9878c6" strokeWidth="1.5" />
        <path d="M23.5 38 a4.6 5 0 0 0 9 0" fill={`url(#${gradId})`} stroke="#9878c6" strokeWidth="1.5" />
        <path d="M22 37 C21.6 33 21.6 30 22 27" fill="none" stroke="#b193dc" strokeWidth="1.3" strokeLinecap="round" opacity=".45" />
        <path d="M9 16 C7 22 7.5 28 11 33" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" opacity=".55" />
      </svg>
    </div>
  );
}

export type PopupPeekProps = {
  open: boolean;
  /** Fires on scrim click AND once the exit animation has fully finished. */
  onClosed?: () => void;
  children?: React.ReactNode;
  /** Must match your modal width — the rig and hand positions derive from it. */
  cardWidth?: number;
  cardRadius?: number;
  gazeTracking?: boolean;
  className?: string;
  cardStyle?: React.CSSProperties;
};

export default function PopupPeek({
  open,
  onClosed,
  children,
  cardWidth = 480,
  cardRadius = 28,
  gazeTracking = true,
  className,
  cardStyle,
}: PopupPeekProps) {
  const [mounted, setMounted] = useState(open);
  const [layout, setLayout] = useState({ fit: 1, top: RIG.clip.h + RIG_MARGIN });
  const phase = useRef<Phase>("closed");
  const t = useRef(0);
  const last = useRef(0);
  const gaze = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const uid = useId().replace(/:/g, "");

  // onClosed lives in a ref so the rAF loop never restarts when the parent
  // passes a fresh closure — restarting mid-climb would reset the timeline.
  const closedCb = useRef(onClosed);
  useEffect(() => {
    closedCb.current = onClosed;
  }, [onClosed]);

  const scrimRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const eyeLRef = useRef<HTMLDivElement | null>(null);
  const eyeRRef = useRef<HTMLDivElement | null>(null);
  const lidsRef = useRef<SVGSVGElement | null>(null);
  const mouthRef = useRef<SVGPathElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const edgeRef = useRef<SVGPathElement | null>(null);
  const handLRef = useRef<HTMLDivElement | null>(null);
  const handRRef = useRef<HTMLDivElement | null>(null);
  const handLInRef = useRef<HTMLDivElement | null>(null);
  const handRInRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);

  const shift = rigShift(cardWidth);

  const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);

  // Adjusted during render, not in an effect — the rig must exist in the same
  // commit that flips `open`, or the climb starts a frame late.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open) {
      phase.current = "enter";
      t.current = 0;
      last.current = 0;
    } else if (phase.current !== "closed") {
      phase.current = "exit";
      t.current = 0;
      last.current = 0;
    }
  }, [open]);

  // Place the stage so the mascot AND the card are both fully on screen.
  //
  //   top >= RIG_MARGIN + rig height     — head clear of the viewport top
  //   top + card height <= vh - BOTTOM_MARGIN
  //
  // If the pair can't fit at full size the whole stage scales down uniformly
  // (transform-origin is the card's top edge, so the rig shrinks toward it and
  // the two constraints stay satisfied). Cards should set a maxHeight so they
  // scroll internally rather than driving the scale down to nothing.
  useEffect(() => {
    if (!mounted) return;
    const measure = () => {
      const cardH = cardRef.current?.offsetHeight ?? 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // No lower clamp: overflowing the viewport is worse than small type. A
      // card that scales this far down wants a narrower `width` for that
      // breakpoint rather than rescue here.
      const widthFit = (vw - 32) / cardWidth;
      const heightFit = (vh - RIG_MARGIN - BOTTOM_MARGIN) / (RIG.clip.h + cardH);
      const fit = Math.min(1, widthFit, heightFit);

      const minTop = RIG_MARGIN + RIG.clip.h * fit;
      const maxTop = vh - BOTTOM_MARGIN - cardH * fit;
      const top = Math.min(Math.max(vh * PREFERRED_TOP, minTop), Math.max(minTop, maxTop));

      setLayout((prev) => (prev.fit === fit && prev.top === top ? prev : { fit, top }));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    const card = cardRef.current;
    if (card) ro.observe(card);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [mounted, cardWidth]);

  useEffect(() => {
    if (!gazeTracking || !mounted) return;
    const onMove = (e: MouseEvent) => {
      const stage = modalRef.current;
      if (!stage) return;
      const b = stage.getBoundingClientRect();
      if (!b.width || !b.height) return;
      gaze.current.tx = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width - 0.58) * 2.4));
      gaze.current.ty = Math.max(-1, Math.min(1, ((e.clientY - b.top) / b.height - 0.34) * 2.2));
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [gazeTracking, mounted]);

  const apply = useCallback(
    (v: Sampled, st: number) => {
      const card = cardRef.current;
      if (!card) return;
      const g = gaze.current;

      const scrim = scrimRef.current;
      if (scrim) {
        scrim.style.opacity = String(v.scrim);
        scrim.style.pointerEvents = v.scrim > 0.5 ? "auto" : "none";
      }
      const modal = modalRef.current;
      if (modal) {
        modal.style.opacity = v.cardOpacity > 0.01 ? "1" : "0";
        modal.style.pointerEvents = v.cardOpacity > 0.6 ? "auto" : "none";
      }

      card.style.transform =
        `translateY(${v.cardY}px) scale(${v.cardScale}) scaleY(${1 - v.cardSquash * 0.009}) rotate(${v.cardRoll}deg)`;
      card.style.opacity = String(v.cardOpacity);

      const d = Math.max(0, v.dip);
      if (edgeRef.current) edgeRef.current.setAttribute("d", edgePath(d, cardWidth, cardRadius, shift));

      const hand = (
        wrap: HTMLDivElement | null,
        inner: HTMLDivElement | null,
        reveal: number,
        x: number
      ) => {
        if (!wrap) return;
        const rv = Math.max(0, Math.min(1, reveal));
        wrap.style.clipPath = `inset(0 0 ${(100 - rv * 100).toFixed(2)}% 0)`;
        wrap.style.left = x + "px";
        wrap.style.transform = `translateY(${v.handDrop + d * 0.9}px)`;
        if (inner)
          inner.style.transform = `${inner.dataset.mirror ? "scaleX(-1) " : ""}scaleY(${1 - d * 0.006})`;
      };
      hand(handLRef.current, handLInRef.current, v.handL, RIG.hand.leftX + shift);
      hand(handRRef.current, handRInRef.current, v.handR, RIG.hand.rightX + shift);

      const drift = phase.current === "live" ? (g.x || 0) * 3.5 : 0;
      if (rigRef.current) rigRef.current.style.transform = `translateY(${v.rigY}px) translateX(${drift}px)`;

      const breath = phase.current === "live" ? Math.sin(((st - 1900) / 3400) * Math.PI * 2) * 0.007 : 0;
      if (headRef.current)
        headRef.current.style.transform =
          `perspective(1000px) rotateX(${v.headRotX}deg) rotateZ(${v.headRotZ}deg) scaleY(${1 + breath})`;

      const ex = (g.x || 0) * 7,
        ey = (g.y || 0) * 4;
      const eye = `translate(${ex}px,${ey}px) scaleY(${v.eyeScale}) scaleX(${1 + (v.eyeScale - 1) * 0.4})`;
      if (eyeLRef.current) eyeLRef.current.style.transform = eye;
      if (eyeRRef.current) eyeRRef.current.style.transform = eye;
      if (lidsRef.current) lidsRef.current.style.opacity = String(Math.max(0, 1 - v.eyeScale - 0.4) * 1.7);

      const m = v.mouth;
      if (mouthRef.current)
        mouthRef.current.setAttribute(
          "d",
          `M${112 + (1 - m) * 6} ${412 - m * 2} Q136 ${424 + m * 12} ${160 - (1 - m) * 6} ${412 - m * 2}`
        );

      if (shadowRef.current) {
        shadowRef.current.style.opacity = String(Math.max(0, 1 - v.rigY / 300) * 0.8);
        shadowRef.current.style.transform = `translateX(${(g.x || 0) * 6}px)`;
      }
    },
    [cardWidth, cardRadius, shift]
  );

  useEffect(() => {
    if (!mounted) return;
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(48, last.current ? now - last.current : 16);
      last.current = now;
      if (phase.current !== "closed") t.current += dt;
      const st = t.current;

      if (reduced) {
        const fade = Math.min(1, st / 260);
        const v = sample(ENTER, 3300);
        v.cardOpacity = phase.current === "exit" ? 1 - fade : fade;
        v.scrim = v.cardOpacity;
        v.cardY = 0;
        v.cardScale = 1;
        apply(v, 3300);
        if (phase.current === "enter" && st > 300) phase.current = "live";
        if (phase.current === "exit" && st > 300) {
          phase.current = "closed";
          setMounted(false);
          closedCb.current?.();
        }
        return;
      }

      let v: Sampled;
      if (phase.current === "closed") v = { ...CLOSED };
      else v = sample(phase.current === "exit" ? EXIT : ENTER, st, CLOSED);

      if (phase.current === "enter" && st > 1980) phase.current = "live";
      if (phase.current === "exit" && st > EXIT_DURATION) {
        phase.current = "closed";
        t.current = 0;
        v = { ...CLOSED };
        setMounted(false);
        closedCb.current?.();
      }

      // idle: breath only, once landed
      const live = phase.current === "live" ? Math.min(1, (st - 1900) / 400) : 0;
      if (live > 0) {
        v.rigY += Math.sin(((st - 1900) / 3400) * Math.PI * 2) * 2.6 * live;
        v.dip += Math.sin(((st - 1900) / 3400) * Math.PI * 2 + 0.6) * 0.4 * live;
      }

      const g = gaze.current,
        k = Math.min(1, dt / 140);
      g.x += ((gazeTracking ? g.tx : 0) * live - g.x) * k;
      g.y += ((gazeTracking ? g.ty : 0) * live - g.y) * k;
      if (!isFinite(g.x)) g.x = 0;
      if (!isFinite(g.y)) g.y = 0;

      apply(v, st);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mounted, apply, reduced, gazeTracking]);

  if (!mounted) return null;

  const S = RIG.scale;
  const cardBg = (cardStyle?.background as string) ?? "#fff";
  return (
    <>
      <div
        ref={scrimRef}
        onClick={() => closedCb.current?.()}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(58,32,104,.34)",
          WebkitBackdropFilter: "blur(3px)",
          backdropFilter: "blur(3px)",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <div
        ref={modalRef}
        className={className}
        style={{
          position: "fixed",
          left: "50%",
          top: layout.top,
          zIndex: 61,
          width: cardWidth,
          marginLeft: (-cardWidth / 2) * layout.fit,
          transform: layout.fit < 1 ? `scale(${layout.fit})` : undefined,
          transformOrigin: "50% 0",
          opacity: 0,
        }}
      >
        {/* rig clip box — its BOTTOM edge is the card's top edge, so the mascot can never draw over content */}
        <div
          style={{
            position: "absolute",
            left: RIG.offsetLeft + shift,
            top: -RIG.clip.h,
            width: RIG.clip.w,
            height: RIG.clip.h,
            overflow: "hidden",
          }}
        >
          <div
            ref={rigRef}
            style={{ position: "absolute", left: 0, top: 0, width: RIG.clip.w, height: 280, transform: "translateY(300px)" }}
          >
            <div style={{ width: RIG.plate.w, height: RIG.plate.h, transformOrigin: "0 0", transform: `scale(${S})` }}>
              <div
                ref={headRef}
                style={{
                  position: "absolute",
                  inset: 0,
                  transformOrigin: "50% 100%",
                  filter: "saturate(1.12) contrast(1.03) drop-shadow(0 18px 26px rgba(74,44,128,.26))",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ART} alt="" style={{ position: "absolute", left: 0, top: 0, width: RIG.plate.w, height: RIG.plate.h }} />
                <div ref={eyeLRef} style={{ position: "absolute", left: RIG.eyeL.x, top: RIG.eyeL.y, width: RIG.eyeL.w, height: RIG.eyeL.h }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(178deg,#1d1540 0%,#0b0719 44%,#3c2b66 78%,#a37ccf 100%)" }}>
                    <div style={{ position: "absolute", left: "14%", top: "11%", width: "38%", height: "23%", borderRadius: "50%", background: "#fff", opacity: 0.96 }} />
                  </div>
                </div>
                <div ref={eyeRRef} style={{ position: "absolute", left: RIG.eyeR.x, top: RIG.eyeR.y, width: RIG.eyeR.w, height: RIG.eyeR.h }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "linear-gradient(178deg,#1d1540 0%,#0b0719 44%,#3c2b66 78%,#a37ccf 100%)" }}>
                    <div style={{ position: "absolute", left: "13%", top: "10%", width: "36%", height: "22%", borderRadius: "50%", background: "#fff", opacity: 0.96 }} />
                  </div>
                </div>
                <svg ref={lidsRef} viewBox="0 0 492 608" style={{ position: "absolute", inset: 0, width: RIG.plate.w, height: RIG.plate.h, opacity: 0, pointerEvents: "none" }}>
                  <path d="M32 354 Q54 336 76 354" fill="none" stroke="#2c1f52" strokeWidth="7" strokeLinecap="round" />
                  <path d="M200 356 Q236 334 272 356" fill="none" stroke="#2c1f52" strokeWidth="7" strokeLinecap="round" />
                </svg>
                <svg viewBox="0 0 492 608" style={{ position: "absolute", inset: 0, width: RIG.plate.w, height: RIG.plate.h, pointerEvents: "none" }}>
                  <path ref={mouthRef} d="M112 412 Q136 424 160 412" fill="none" stroke="#4a3572" strokeWidth="5.4" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div ref={cardRef} style={{ position: "relative", transformOrigin: "50% 100%" }}>
          <div
            style={{
              position: "relative",
              borderRadius: cardRadius,
              background: "#fff",
              overflow: "hidden",
              // Flex column so a maxHeight on the card propagates down to a
              // scrollable region inside it. Without a definite height here,
              // `height: 100%` children resolve to auto and never scroll.
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 42px 80px -34px rgba(60,30,112,.55), 0 0 0 1px rgba(151,116,206,.14)",
              padding: "56px 40px 34px",
              ...cardStyle,
            }}
          >
            <div
              ref={shadowRef}
              style={{
                position: "absolute",
                left: "50%",
                top: -46,
                width: 300,
                height: 92,
                marginLeft: -92,
                borderRadius: "50%",
                background: "radial-gradient(closest-side,rgba(72,40,128,.34),rgba(72,40,128,0))",
                opacity: 0,
                pointerEvents: "none",
              }}
            />
            {children}
          </div>

          {/* deformable top edge — sits ON TOP of the card, painted the card colour */}
          <svg
            viewBox={`0 0 ${cardWidth} 64`}
            style={{ position: "absolute", left: 0, top: 0, width: cardWidth, height: 64, pointerEvents: "none", overflow: "visible" }}
          >
            <path ref={edgeRef} d={edgePath(0, cardWidth, cardRadius, shift)} fill={cardBg} />
          </svg>

          <div ref={handLRef} style={{ position: "absolute", left: RIG.hand.leftX + shift, top: 0, width: 44, height: 50, marginTop: RIG.hand.marginTop, clipPath: "inset(0 0 100% 0)" }}>
            <Paw innerRef={handLInRef} gradId={`peek-paw-${uid}`} />
          </div>
          <div ref={handRRef} style={{ position: "absolute", left: RIG.hand.rightX + shift, top: 0, width: 44, height: 50, marginTop: RIG.hand.marginTop, clipPath: "inset(0 0 100% 0)" }}>
            <Paw innerRef={handRInRef} mirror gradId={`peek-paw-r-${uid}`} />
          </div>
        </div>
      </div>
    </>
  );
}
