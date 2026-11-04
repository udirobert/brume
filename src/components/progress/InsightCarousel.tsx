/**
 * One honest observation from real history. Earned, never padded.
 * Sits in the mist — no dashboard chrome.
 */
import React, { useMemo, useState } from "react";
import { parseISO, differenceInCalendarDays } from "date-fns";
import { Sparkline } from "@/components/primitives/Sparkline";

interface SessionLike {
  created_at: string;
  session_duration: number | null;
  restlessness_score: number | null;
  pattern_name: string | null;
}

interface Insight {
  key: string;
  prose: string;
  points: number[];
  valueLabel: string;
}

function dailySeries(
  history: SessionLike[],
  days: number,
  pick: (s: SessionLike) => number,
): number[] {
  const today = new Date();
  const buckets = new Array(days).fill(0);
  for (const s of history) {
    const d = differenceInCalendarDays(today, parseISO(s.created_at));
    if (d >= 0 && d < days) buckets[days - 1 - d] += pick(s);
  }
  return buckets;
}

function buildInsights(history: SessionLike[]): Insight[] {
  const out: Insight[] = [];

  const minutes = dailySeries(history, 14, (s) => (s.session_duration ?? 0) / 60);
  const thisWeek = minutes.slice(7).reduce((a, b) => a + b, 0);
  const lastWeek = minutes.slice(0, 7).reduce((a, b) => a + b, 0);
  if (thisWeek > 0) {
    const delta =
      lastWeek >= 5 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
    const comparable = delta !== null && Math.abs(delta) < 200;
    out.push({
      key: "momentum",
      prose: comparable
        ? `You practiced ${Math.round(thisWeek)} minutes this week — ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)}% on last week.`
        : `You practiced ${Math.round(thisWeek)} minutes this week.`,
      points: minutes,
      valueLabel: `${Math.round(thisWeek)} min this week`,
    });
  }

  return out;
}

export function InsightCarousel({
  history,
}: {
  history: SessionLike[];
  preferredPattern: string;
}) {
  const insights = useMemo(() => buildInsights(history), [history]);
  const [page, setPage] = useState(0);

  if (insights.length === 0) return null;
  const insight = insights[page % insights.length];
  const move = (dir: -1 | 1) =>
    setPage((c) => (c + dir + insights.length) % insights.length);

  return (
    <div className="w-full text-left">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          {insight.prose}
        </p>
        {insights.length > 1 && (
          <span className="flex shrink-0 items-center gap-0.5 pt-0.5">
            {(["M15 18l-6-6 6-6", "M9 6l6 6-6 6"] as const).map((d, i) => (
              <button
                key={i}
                type="button"
                aria-label={i === 0 ? "Previous" : "Next"}
                onClick={() => move(i === 0 ? -1 : 1)}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={d} />
                </svg>
              </button>
            ))}
          </span>
        )}
      </div>
      <Sparkline points={insight.points} />
      <p className="mt-1 text-[11px] text-muted-foreground">{insight.valueLabel}</p>
    </div>
  );
}

export default InsightCarousel;
