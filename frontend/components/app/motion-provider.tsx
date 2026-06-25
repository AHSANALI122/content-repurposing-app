"use client";

import { MotionConfig } from "framer-motion";

// Client shim so the server-component root layout can opt every Framer Motion
// animation into honoring the user's `prefers-reduced-motion` setting.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
