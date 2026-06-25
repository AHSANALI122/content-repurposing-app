"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError, repurpose } from "@/lib/api";
import { fadeUp } from "@/lib/motion";
import {
  DEFAULT_PLATFORMS,
  DEFAULT_TONE,
  MAX_CHARS,
  MIN_CHARS,
} from "@/lib/constants";
import type { Platform, RepurposeJob, Tone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PlatformCards } from "@/components/app/platform-cards";
import { ToneChips } from "@/components/app/tone-chips";
import { OutputTabs } from "@/components/app/output-tabs";

export function CreateForm() {
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(DEFAULT_PLATFORMS);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<RepurposeJob | null>(null);

  const charCount = sourceText.length;
  const tooShort = charCount < MIN_CHARS;
  const tooLong = charCount > MAX_CHARS;
  const noPlatforms = platforms.length === 0;
  const canSubmit = !tooShort && !tooLong && !noPlatforms && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setJob(null);
    try {
      const result = await repurpose({
        source_text: sourceText,
        title: title.trim() || undefined,
        tone,
        platforms,
      });
      setJob(result);
      toast.success("Content repurposed!");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Inputs */}
      <Card>
        <CardContent className="space-y-5 pt-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="e.g. My launch announcement"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="source">Source content</Label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    tooShort || tooLong
                      ? "text-destructive"
                      : "text-muted-foreground"
                  )}
                >
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
              </div>
              <Textarea
                id="source"
                placeholder="Paste your blog post, transcript, or notes…"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                disabled={loading}
                className="min-h-[200px] thin-scrollbar"
              />
              {tooShort && charCount > 0 && (
                <p className="text-xs text-destructive">
                  At least {MIN_CHARS} characters required.
                </p>
              )}
              {tooLong && (
                <p className="text-xs text-destructive">
                  Content is too long (max {MAX_CHARS.toLocaleString()}).
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Platforms</Label>
              <PlatformCards
                value={platforms}
                onChange={setPlatforms}
                disabled={loading}
              />
              {noPlatforms && (
                <p className="text-xs text-destructive">
                  Select at least one platform.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tone</Label>
              <ToneChips value={tone} onChange={setTone} disabled={loading} />
            </div>

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={!canSubmit}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {loading ? "Repurposing…" : "Repurpose content"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Output */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        {loading ? (
          <OutputSkeleton count={platforms.length || 1} />
        ) : job ? (
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <OutputTabs outputs={job.outputs} />
          </motion.div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
      <div className="rounded-full bg-secondary p-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-4 font-medium">Your copy lands here</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Paste content, pick platforms and a tone, then hit Repurpose to generate
        platform-native posts.
      </p>
    </div>
  );
}

function OutputSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>
      <div className="space-y-3 rounded-lg border p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
