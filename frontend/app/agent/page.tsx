"use client";

import { RequireAuth } from "@/components/app/require-auth";
import { AgentForm } from "@/components/app/agent-form";

export default function AgentPage() {
  return (
    <RequireAuth>
      <div className="mx-auto max-w-5xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Agent
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Give the agent a URL or text. It decides its own steps — fetching the
            page if needed — then writes platform-native copy and shows its trace.
          </p>
        </div>
        <AgentForm />
      </div>
    </RequireAuth>
  );
}
