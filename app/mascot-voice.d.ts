import type { DetailedHTMLProps, HTMLAttributes } from "react";

export type MascotVoiceState = "idle" | "listening" | "thinking" | "speaking" | "asking";

export interface MascotVoiceElement extends HTMLElement {
  state: MascotVoiceState;
  text: string;
  level: number;
  readonly spokenChars: number;
  readonly busy: boolean;
  blink(): void;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "mascot-voice": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: number | string;
        state?: MascotVoiceState;
        text?: string;
        level?: number | string;
        assets?: string;
        motion?: number | string;
      };
    }
  }
}

export {};
