import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { Button } from "@/components/ui/button";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { InsightCarousel } from "@/components/progress/InsightCarousel";
import { BrumeMascot } from "@/components/BrumeMascot";

function when(iso: string): string {
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "d MMM");
}

function stillness(restlessness: number | null | undefined): string {
  if (typeof restlessness !== "number") return "—";
  return String(Math.max(0, Math.min(100, Math.round(100 - restlessness))));
}

export default function Progress() {
  const { history, streak, totalMinutes, preferredPattern, isGuestMode } =
    useSessionHistory();

  const recent = useMemo(() => history.slice(0, 8), [history]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-4 h-full max-w-md mx-auto">
        <BrumeMascot state="sleepy" size={92} className="mb-4" />
        <h1 className="text-3xl font-bold tracking-tight mb-3">Nothing here yet.</h1>
        <p className="text-muted-foreground mb-8">
          Tap how you feel. One session is the start.
        </p>
        {isGuestMode && (
          <p className="text-sm text-muted-foreground mb-8">
            <Link
              to="/auth?redirect=/progress&context=progress-tracking"
              className="font-medium text-primary hover:underline underline-offset-2"
            >
              Create an account
            </Link>{" "}
            to keep this practice across devices.
          </p>
        )}
        <Button asChild className="rounded-full btn-premium px-10 py-6">
          <Link to="/">Breathe</Link>
        </Button>
      </div>
    );
  }

  const meta = [
    totalMinutes > 0 ? `${totalMinutes} min` : null,
    preferredPattern &&
    preferredPattern !== "None" &&
    preferredPattern !== "Unknown"
      ? preferredPattern
      : null,
    isGuestMode ? "On this device" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center px-2 py-4">
      <BrumeMascot state="proud" size={88} className="mb-3" />
      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
        {streak > 0 ? `Day ${streak}.` : "Your practice."}
      </h1>
      <p className="mt-2 text-muted-foreground">
        One check-in, one session — that's the whole practice.
      </p>
      {meta.length > 0 && (
        <p className="mt-3 text-sm text-muted-foreground">{meta.join(" · ")}</p>
      )}

      <div className="mt-10 w-full">
        <InsightCarousel
          history={history}
          streak={streak}
          preferredPattern={preferredPattern}
        />
      </div>

      <ol className="mt-10 w-full text-left space-y-3">
        {recent.map((session, i) => (
          <li
            key={session.id || `${session.created_at}-${i}`}
            className="flex items-baseline justify-between gap-4 text-[15px]"
          >
            <span className="text-muted-foreground shrink-0 w-24">
              {when(session.created_at)}
            </span>
            <span className="flex-1 truncate">
              {session.pattern_name || "Session"}
            </span>
            <span className="tabular-nums text-muted-foreground shrink-0">
              {stillness(session.restlessness_score)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 w-full text-right text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
        stillness
      </p>

      <Button asChild className="mt-12 rounded-full btn-premium w-full max-w-xs py-6">
        <Link to="/">Breathe</Link>
      </Button>
    </div>
  );
}
