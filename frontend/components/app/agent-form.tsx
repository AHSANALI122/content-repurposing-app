"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Link2, Loader2, Sparkles, Type } from "lucide-react";
import { toast } from "sonner";

import { agentRepurpose, ApiError } from "@/lib/api";
import { fadeUp } from "@/lib/motion";
import { DEFAULT_AGENT_PLATFORMS, DEFAULT_TONE, MIN_CHARS } from "@/lib/constants";
import type { Platform, TraceStep, Tone, RepurposeJob } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PlatformCards } from "@/components/app/platform-cards";
import { ToneChips } from "@/components/app/tone-chips";
import { OutputTabs } from "@/components/app/output-tabs";
import { AgentTrace } from "@/components/app/agent-trace";

type InputMode = "url" | "text";

export function AgentForm() {
  const [mode, setMode] = useState<InputMode>("url");
  const [url, setUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(DEFAULT_AGENT_PLATFORMS);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<RepurposeJob | null>(null);
  const [trace, setTrace] = useState<TraceStep[]>([]);

  const trimmedUrl = url.trim();
  const urlValid = /^https?:\/\/.+/i.test(trimmedUrl);
  const textValid = sourceText.trim().length >= MIN_CHARS;
  const inputValid = mode === "url" ? urlValid : textValid;
  const noPlatforms = platforms.length === 0;
  const canSubmit = inputValid && !noPlatforms && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setJob(null);
    setTrace([]);
    try {
      const result = await agentRepurpose({
        url: mode === "url" ? trimmedUrl : undefined,
        source_text: mode === "text" ? sourceText : undefined,
        tone,
        platforms,
      });
      setTrace(result.trace);
      setJob(result.job);
      toast.success("Agent finished!");
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
            {/* Input mode toggle */}
            <div className="space-y-2">
              <Label>Source</Label>
              <div className="grid grid-cols-2 gap-2">
                <ModeButton
                  active={mode === "url"}
                  onClick={() => setMode("url")}
                  disabled={loading}
                  icon={Link2}
                  label="From URL"
                />
                <ModeButton
                  active={mode === "text"}
                  onClick={() => setMode("text")}
                  disabled={loading}
                  icon={Type}
                  label="Paste text"
                />
              </div>
            </div>

            {mode === "url" ? (
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/blog-post"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                />
                {trimmedUrl.length > 0 && !urlValid && (
                  <p className="text-xs text-destructive">
                    Enter a valid http(s) URL.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="source">Source content</Label>
                <Textarea
                  id="source"
                  placeholder="Paste your blog post, transcript, or notes…"
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value)}
                  disabled={loading}
                  className="min-h-[180px] thin-scrollbar"
                />
                {sourceText.trim().length > 0 && !textValid && (
                  <p className="text-xs text-destructive">
                    At least {MIN_CHARS} characters required.
                  </p>
                )}
              </div>
            )}

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
                <Bot className="h-4 w-4" />
              )}
              {loading ? "Agent working…" : "Run agent"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Output */}
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {loading ? (
          <ThinkingState />
        ) : job ? (
          <div className="space-y-5">
            {trace.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Agent trace
                </h3>
                <AgentTrace trace={trace} />
              </div>
            )}
            <motion.div variants={fadeUp} initial="hidden" animate="show">
              <OutputTabs outputs={job.outputs} />
            </motion.div>
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Link2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-input text-muted-foreground hover:border-primary/50 hover:bg-secondary"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function ThinkingState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
      <div className="rounded-full bg-secondary p-3">
        <Bot className="h-6 w-6 animate-pulse text-primary" />
      </div>
      <h3 className="mt-4 font-medium">Agent is thinking…</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Reading your source, deciding its steps, and drafting platform-native copy.
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
      <div className="rounded-full bg-secondary p-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-4 font-medium">Let the agent run</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Give it a URL or paste text, pick platforms and a tone, then hit Run agent.
        You&apos;ll see its steps and the final copy here.
      </p>
    </div>
  );
}
