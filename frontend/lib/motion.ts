import type { Variants } from "framer-motion";

// Shared Framer Motion variants so Feature 5's entrance / trace-reveal /
// list-transition animations share one consistent cadence (spec §4 Feature 5).

// Fade + slight rise. Used for entrance reveals and as the per-item variant
// inside staggered lists.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

// Reveals children one-by-one. The 120ms step matches the cadence the agent
// trace used before the Framer Motion migration.
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12 },
  },
};
