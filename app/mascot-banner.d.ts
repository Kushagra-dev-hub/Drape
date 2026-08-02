import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "mascot-banner": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: number | string;
        assets?: string;
        messages?: string;
        message?: string;
        cycle?: number | string;
        motion?: number | string;
      };
    }
  }
}

export {};
