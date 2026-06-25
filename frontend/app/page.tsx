"use client";

import { RequireAuth } from "@/components/app/require-auth";
import { CreateForm } from "@/components/app/create-form";

export default function HomePage() {
  return (
    <RequireAuth>
      <div className="mx-auto max-w-5xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Create
            </span>
          </h1>
          <p className="mt-1 text-muted-foreground">
            Paste your content, choose platforms and a tone, and get
            platform-native copy in seconds.
          </p>
        </div>
        <CreateForm />
      </div>
    </RequireAuth>
  );
}
