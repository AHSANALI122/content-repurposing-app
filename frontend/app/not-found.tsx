import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-6xl font-bold tracking-tight text-transparent">
        404
      </span>
      <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        That page doesn&apos;t exist. Head back to Create to repurpose your content.
      </p>
      <Button asChild variant="gradient" className="mt-6">
        <Link href="/">Back to Create</Link>
      </Button>
    </div>
  );
}
