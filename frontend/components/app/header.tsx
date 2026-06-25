"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/", label: "Create" },
  { href: "/agent", label: "Agent" },
  { href: "/history", label: "History" },
];

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-lg font-bold tracking-tight text-transparent">
              Echo
            </span>
          </Link>
          {user && (
            <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
