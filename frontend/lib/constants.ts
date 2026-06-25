import {
  Twitter,
  Linkedin,
  Instagram,
  Mail,
  type LucideIcon,
} from "lucide-react";

import type { Platform, Tone } from "@/lib/types";

export const PLATFORMS: {
  value: Platform;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "twitter",
    label: "X / Twitter",
    description: "5–8 tweet thread",
    icon: Twitter,
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    description: "Hook + hashtags",
    icon: Linkedin,
  },
  {
    value: "instagram",
    label: "Instagram",
    description: "Caption + hashtags",
    icon: Instagram,
  },
  {
    value: "newsletter",
    label: "Newsletter",
    description: "Subject + body",
    icon: Mail,
  },
];

export const TONES: { value: Tone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "witty", label: "Witty" },
  { value: "bold", label: "Bold" },
];

export const DEFAULT_PLATFORMS: Platform[] = [
  "twitter",
  "linkedin",
  "instagram",
];

// Agent mode defaults to a tighter set than Create (per spec).
export const DEFAULT_AGENT_PLATFORMS: Platform[] = ["twitter", "linkedin"];

export const DEFAULT_TONE: Tone = "professional";

export const MIN_CHARS = 30;
export const MAX_CHARS = 20000;

/** Human-readable label for a platform value. */
export function platformLabel(value: Platform): string {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value;
}
