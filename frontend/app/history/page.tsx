"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, History as HistoryIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ApiError,
  deleteHistoryJob,
  getHistoryJob,
  listHistory,
} from "@/lib/api";
import { TONES } from "@/lib/constants";
import type { RepurposeJob, RepurposeJobSummary } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OutputTabs } from "@/components/app/output-tabs";
import { RequireAuth } from "@/components/app/require-auth";

function toneLabel(tone: RepurposeJobSummary["tone"]): string {
  return TONES.find((t) => t.value === tone)?.label ?? tone;
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : "Something went wrong. Please try again.";
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<RepurposeJobSummary[] | null>(null);
  const [selected, setSelected] = useState<RepurposeJob | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    listHistory()
      .then((data) => {
        if (active) setJobs(data);
      })
      .catch((err) => {
        if (active) setJobs([]);
        toast.error(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);

  async function openJob(id: number) {
    setOpeningId(id);
    try {
      const job = await getHistoryJob(id);
      setSelected(job);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setOpeningId(null);
    }
  }

  async function removeJob(id: number) {
    const previous = jobs ?? [];
    setJobs(previous.filter((j) => j.id !== id)); // optimistic
    try {
      await deleteHistoryJob(id);
      toast.success("Deleted");
    } catch (err) {
      setJobs(previous); // roll back
      toast.error(errorMessage(err));
    }
  }

  return (
    <RequireAuth>
      <div className="mx-auto max-w-5xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              History
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Your past runs. Open one to view its outputs again, or delete it.
          </p>
        </div>

        {selected ? (
          <JobDetail job={selected} onBack={() => setSelected(null)} />
        ) : jobs === null ? (
          <HistorySkeleton />
        ) : jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                opening={openingId === job.id}
                onOpen={() => openJob(job.id)}
                onDelete={() => removeJob(job.id)}
              />
            ))}
          </div>
        )}
      </div>
    </RequireAuth>
  );
}

function JobCard({
  job,
  opening,
  onOpen,
  onDelete,
}: {
  job: RepurposeJobSummary;
  opening: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer transition-colors hover:border-primary/50 duration-300 animate-in fade-in slide-in-from-bottom-1"
    >
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium">{job.title}</h3>
            {opening && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatRelativeDate(job.created_at)} · {job.platform_count}{" "}
            {job.platform_count === 1 ? "platform" : "platforms"}
          </p>
        </div>
        <Badge variant="gradient" className="shrink-0">
          {toneLabel(job.tone)}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function JobDetail({
  job,
  onBack,
}: {
  job: RepurposeJob;
  onBack: () => void;
}) {
  return (
    <div className="duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className="mb-4 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {job.title}
        </h2>
        <Badge variant="gradient" className="shrink-0">
          {toneLabel(job.tone)}
        </Badge>
      </div>
      <OutputTabs outputs={job.outputs} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
      <div className="rounded-full bg-secondary p-3">
        <HistoryIcon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="mt-4 font-medium">No history yet</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Repurpose some content from Create or Agent and your past runs will show
        up here.
      </p>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border p-4"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}
