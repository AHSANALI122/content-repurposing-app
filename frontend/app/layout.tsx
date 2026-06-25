import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/app/header";

export const metadata: Metadata = {
  title: "Echo — Write once. Publish everywhere.",
  description:
    "Repurpose long-form content into platform-native copy for X, LinkedIn, Instagram, and email.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="aurora-bg" aria-hidden />
        <AuthProvider>
          <Header />
          <main className="container py-8">{children}</main>
          <Toaster theme="dark" position="top-center" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
