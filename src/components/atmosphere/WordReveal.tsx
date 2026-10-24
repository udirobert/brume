import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type WordPart = string | { text: string; className?: string };

interface WordRevealProps {
  parts: WordPart[];
  as?: "h1" | "h2" | "p";
  className?: string;
}

const ease = [0.16, 1, 0.3, 1] as const;

function flatten(parts: WordPart[]): { text: string; className?: string; space?: boolean }[] {
  const out: { text: string; className?: string; space?: boolean }[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      const bits = part.split(/(\s+)/);
      for (const bit of bits) {
        if (!bit) continue;
        if (!bit.trim()) out.push({ text: bit, space: true });
        else out.push({ text: bit });
      }
    } else {
      out.push(part);
    }
  }
  return out;
}

export function WordReveal({ parts, as = "h1", className }: WordRevealProps) {
  const reduceMotion = useReducedMotion();
  const skipMotion = reduceMotion || (typeof document !== "undefined" && document.hidden);
  const tokens = useMemo(() => flatten(parts), [parts]);
  const label = useMemo(
    () => tokens.map((t) => t.text).join(""),
    [tokens],
  );

  const Tag = as;

  if (skipMotion) {
    return (
      <Tag className={className}>
        {tokens.map((t, i) =>
          t.space ? (
            t.text
          ) : (
            <span key={`${t.text}-${i}`} className={t.className}>
              {t.text}
            </span>
          ),
        )}
      </Tag>
    );
  }

  return (
    <Tag className={className} aria-label={label}>
      {tokens.map((t, i) => {
        if (t.space) {
          return (
            <span key={`s-${i}`} aria-hidden="true">
              {t.text}
            </span>
          );
        }
        const wordIndex = tokens.slice(0, i).filter((x) => !x.space).length;
        return (
          <motion.span
            key={`${t.text}-${i}`}
            className={cn("inline-block", t.className)}
            aria-hidden="true"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.45,
              ease,
              delay: wordIndex * 0.04,
            }}
          >
            {t.text}
          </motion.span>
        );
      })}
    </Tag>
  );
}

export default WordReveal;
