"use client";

import { RequireAuth } from "@/components/app/require-auth";

export default function HomePage() {
  return (
    <RequireAuth>
      <div className="mx-auto max-w-2xl py-16 text-center">
        <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Write once. Publish everywhere.
        </h1>
        <p className="mt-4 text-muted-foreground">
          You&apos;re signed in. The Create experience lands with Feature 2.
        </p>
      </div>
    </RequireAuth>
  );
}
