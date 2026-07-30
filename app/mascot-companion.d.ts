import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "mascot-companion": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        size?: number | string;
        state?: "idle" | "email" | "typing" | "password" | "hover" | "submit" | "success" | "error";
        assets?: string;
        motion?: number | string;
      };
    }
  }
}

export {};
