"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

import type { TraceStep, TraceStepType } from "@/lib/types";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { cn } from "@/lib/utils";

const STEP_META: Record<
  TraceStepType,
  { icon: LucideIcon; className: string }
> = {
  tool: { icon: Globe, className: "text-primary" },
  note: { icon: MessageSquare, className: "text-muted-foreground" },
  finish: { icon: CheckCircle2, className: "text-emerald-400" },
  error: { icon: AlertTriangle, className: "text-destructive" },
};

export function AgentTrace({ trace }: { trace: TraceStep[] }) {
  if (trace.length === 0) return null;

  return (
    // Staggered reveal for an agentic feel (Framer Motion, spec §4 Feature 5).
    <motion.ol
      className="space-y-2"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {trace.map((step, i) => {
        const { icon: Icon, className } = STEP_META[step.type];
        return (
          <motion.li
            key={i}
            variants={fadeUp}
            className="flex items-start gap-3 rounded-lg border bg-card/50 px-3 py-2"
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} />
            <span className="text-sm leading-relaxed text-foreground/90">
              {step.detail}
            </span>
          </motion.li>
        );
      })}
    </motion.ol>
  );
}
