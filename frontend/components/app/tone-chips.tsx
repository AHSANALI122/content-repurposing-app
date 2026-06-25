"use client";

import { TONES } from "@/lib/constants";
import type { Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ToneChipsProps {
  value: Tone;
  onChange: (next: Tone) => void;
  disabled?: boolean;
}

export function ToneChips({ value, onChange, disabled }: ToneChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TONES.map(({ value: tone, label }) => {
        const selected = value === tone;
        return (
          <button
            key={tone}
            type="button"
            onClick={() => !disabled && onChange(tone)}
            disabled={disabled}
            aria-pressed={selected}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "border-transparent bg-gradient-to-r from-primary to-accent text-white shadow"
                : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
