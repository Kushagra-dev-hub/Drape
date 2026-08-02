"use client";

import { useCallback, useEffect, useState } from "react";
import PopupPeek from "./popup-peek/PopupPeek";

export type ModalProps = {
  open: boolean;
  /** Called when the user dismisses (scrim click, Escape, or your own close button). */
  onClose: () => void;
  children: React.ReactNode;
  /** Card width in px. The mascot's hand positions derive from it. */
  width?: number;
  radius?: number;
  /** Merged into the card — use for padding, background, maxHeight. */
  cardStyle?: React.CSSProperties;
  /** Accessible name for the dialog. */
  label?: string;
  gazeTracking?: boolean;
};

/**
 * The app's one modal primitive. Wraps PopupPeek so every popup gets the mascot
 * climb-in / climb-out for free.
 *
 * The lifecycle detail that matters: PopupPeek plays its own ~1s exit, so the
 * card must stay mounted after `open` flips to false. This component holds it
 * mounted and tears down only once PopupPeek reports the exit is finished —
 * unmounting on click would cut the mascot off mid-descent.
 *
 *   <Modal open={open} onClose={() => setOpen(false)} width={560}>
 *     ...content...
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  children,
  width = 480,
  radius = 28,
  cardStyle,
  label,
  gazeTracking = true,
}: ModalProps) {
  const [rendered, setRendered] = useState(open);

  // Adjusted during render, not in an effect: the card has to exist in the same
  // commit that opens it so PopupPeek's timeline starts at t=0.
  if (open && !rendered) setRendered(true);

  // PopupPeek fires onClosed for two different things: a scrim click (while
  // still open) and the end of the exit animation (after open went false).
  const handleClosed = useCallback(() => {
    if (open) onClose();
    else setRendered(false);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock background scroll for as long as anything is on screen, exit included.
  useEffect(() => {
    if (!rendered) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [rendered]);

  if (!rendered) return null;

  return (
    <PopupPeek
      open={open}
      onClosed={handleClosed}
      cardWidth={width}
      cardRadius={radius}
      gazeTracking={gazeTracking}
      cardStyle={cardStyle}
    >
      {/* flex:1 + minHeight:0 rather than height:100% — this is the link that
          lets a card's maxHeight bound a scroll region further down. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }}
      >
        {children}
      </div>
    </PopupPeek>
  );
}

export default Modal;
