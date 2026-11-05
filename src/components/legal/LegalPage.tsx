import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * LegalPage — shared chrome for /privacy and /terms so both documents sit
 * on the same brand surface as the rest of the app.
 */

export function LegalPage({
  title,
  lede,
  updated,
  footer,
  children,
}: {
  title: string;
  lede: string;
  updated: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-calm-gradient">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-block text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            &larr; Back to Brume
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-muted-foreground">{lede}</p>
          <p className="mt-2 text-sm text-muted-foreground/70">{updated}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm p-6 sm:p-8 mb-8">
          {children}
        </div>

        {footer}
      </div>
    </div>
  );
}

export function LegalTOC({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  return (
    <nav className="mb-8 space-y-2">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="block text-sm text-primary hover:underline underline-offset-2"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-8">
      <h2 className="text-xl font-semibold text-foreground mb-3">{title}</h2>
      <div className="space-y-4 text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export function LegalH3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-medium text-foreground mb-2">{children}</h3>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-inside space-y-1">{children}</ul>;
}

export function LegalCallout({
  tone = "note",
  children,
}: {
  tone?: "note" | "warning" | "good";
  children: React.ReactNode;
}) {
  const tones = {
    note: "bg-primary/5 border-primary/20 text-foreground",
    warning: "bg-destructive/5 border-destructive/25 text-foreground",
    good: "bg-foreground/5 border-border/70 text-foreground",
  } as const;
  return (
    <div className={cn("p-4 rounded-xl border mb-4", tones[tone])}>
      {children}
    </div>
  );
}

export function LegalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-sm text-muted-foreground/70">
      {children}
    </div>
  );
}
