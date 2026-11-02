/**
 * ContextCard — source-grounded explanation chips.
 * Adapted from the agentic ContextCards primitive (lite).
 *
 * Brume use: Zen says WHY — "We chose Physiological Sigh because your
 * resting rate was elevated" — with the source attached. Coaching that
 * cites its evidence is the trust layer made visible.
 */
import React from "react";
import { cn } from "@/lib/utils";

export interface ContextChunk {
  title: string;
  body: string;
  source: string; // e.g. "Your session data", "Pranayama tradition", "Huberman protocol"
}

export function ContextCards({ chunks, className }: { chunks: ContextChunk[]; className?: string }) {
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {chunks.map((chunk, i) => (
        <div
          key={chunk.title}
          className="fade-up overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" aria-hidden className="shrink-0 text-muted-foreground">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            <span className="truncate text-[13px] font-medium text-foreground">{chunk.title}</span>
          </div>
          <p className="px-3 pb-2 pt-2 text-[12.5px] leading-relaxed text-muted-foreground">{chunk.body}</p>
          <div className="px-3 pb-3">
            <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-muted px-2 text-[12px] font-medium text-muted-foreground">
              {chunk.source}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ContextCards;
