"use client";

import { Check } from "lucide-react";

import { PLATFORMS } from "@/lib/constants";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlatformCardsProps {
  value: Platform[];
  onChange: (next: Platform[]) => void;
  disabled?: boolean;
}

export function PlatformCards({
  value,
  onChange,
  disabled,
}: PlatformCardsProps) {
  function toggle(platform: Platform) {
    if (disabled) return;
    onChange(
      value.includes(platform)
        ? value.filter((p) => p !== platform)
        : [...value, platform]
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {PLATFORMS.map(({ value: platform, label, description, icon: Icon }) => {
        const selected = value.includes(platform);
        return (
          <button
            key={platform}
            type="button"
            onClick={() => toggle(platform)}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
              "relative flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "border-primary bg-primary/10"
                : "border-input hover:border-primary/50 hover:bg-secondary"
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 h-5 w-5 shrink-0",
                selected ? "text-primary" : "text-muted-foreground"
              )}
            />
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">{label}</div>
              <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            {selected && (
              <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
