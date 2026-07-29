import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "mascot-hello": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: number | string;
        greeting?: string;
        warmth?: number | string;
        assets?: string;
        paused?: boolean;
      };
    }
  }
}

export {};
