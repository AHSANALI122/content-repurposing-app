"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PLATFORMS } from "@/lib/constants";
import type { RepurposeOutput } from "@/lib/types";
import { fadeUp } from "@/lib/motion";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Copy manually instead.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <AnimatePresence initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inline-flex"
            >
              <Check className="h-4 w-4 text-primary" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inline-flex"
            >
              <Copy className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function OutputTabs({ outputs }: { outputs: RepurposeOutput[] }) {
  if (outputs.length === 0) return null;

  function label(platform: RepurposeOutput["platform"]) {
    return PLATFORMS.find((p) => p.value === platform)?.label ?? platform;
  }

  return (
    <Tabs defaultValue={outputs[0].platform} className="w-full">
      <TabsList className="flex w-full flex-wrap justify-start">
        {outputs.map((o) => {
          const Icon = PLATFORMS.find((p) => p.value === o.platform)?.icon;
          return (
            <TabsTrigger key={o.platform} value={o.platform}>
              {Icon && <Icon />}
              {label(o.platform)}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {outputs.map((o) => (
        <TabsContent key={o.platform} value={o.platform}>
          <motion.div
            className="rounded-lg border bg-card"
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium">{label(o.platform)}</span>
              <CopyButton text={o.content} />
            </div>
            <pre className="thin-scrollbar max-h-[460px] overflow-auto whitespace-pre-wrap break-words p-4 font-sans text-sm leading-relaxed">
              {o.content}
            </pre>
          </motion.div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
