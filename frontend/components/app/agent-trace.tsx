"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

import type { TraceStep, TraceStepType } from "@/lib/types";
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
    <ol className="space-y-2">
      {trace.map((step, i) => {
        const { icon: Icon, className } = STEP_META[step.type];
        return (
          <li
            key={i}
            // Staggered reveal for an agentic feel (CSS, no extra deps).
            className="flex items-start gap-3 rounded-lg border bg-card/50 px-3 py-2 duration-300 animate-in fade-in slide-in-from-bottom-1 fill-mode-both"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", className)} />
            <span className="text-sm leading-relaxed text-foreground/90">
              {step.detail}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
