"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";

/** Shared auth card used by both /login and /signup (via `initialMode`). */
export function AuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const { user, loading, login, register } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → leave the auth page.
  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  // While auth is resolving, or if already signed in (redirect in flight),
  // don't render the login/signup form at all.
  if (loading || user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      toast.success(mode === "login" ? "Welcome back!" : "Account created!");
      router.replace("/");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Sign in to repurpose your content."
              : "Sign up to start repurposing content."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Sign up"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() =>
                setMode((m) => (m === "login" ? "register" : "login"))
              }
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
