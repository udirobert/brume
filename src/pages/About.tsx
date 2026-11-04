import React from "react";
import { Link } from "react-router-dom";
import { BrumeMascot } from "@/components/BrumeMascot";
import { FEELINGS } from "@/lib/feelings";
import { ROOM_LABELS, ROOM_MATERIALS } from "@/lib/roomExperience";
import { formatPhases, getPattern } from "@/lib/breathingPatterns";

/**
 * About — the metaphor, not a manual. Everything on this page renders
 * from the same data the app runs on (feelings, patterns, materials),
 * so it can never drift out of date. The one rule: describe what
 * things are, never what they do to you.
 */
export default function About() {
  const materials = ROOM_MATERIALS.map((m) => ROOM_LABELS[m]).join(" · ");

  return (
    <div className="w-full max-w-md mx-auto flex flex-col px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <BrumeMascot state="watching" size={92} className="mb-4" layoutId="brume-companion" />
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          About Brume.
        </h1>
        <p className="mt-3 text-muted-foreground">
          One check-in, one rhythm, one moment. That is the whole practice.
        </p>
      </div>

      {/* The mapping — each word carries a rhythm, rendered from the catalog. */}
      <section className="mt-12" aria-labelledby="about-rhythms">
        <h2 id="about-rhythms" className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Every word carries a rhythm
        </h2>
        <ol className="mt-4 space-y-3">
          {FEELINGS.map((feel) => {
            const pattern = getPattern(feel.patternId);
            return (
              <li
                key={feel.id}
                className="flex items-baseline justify-between gap-4 text-[15px]"
              >
                <span className="text-foreground">{feel.label}</span>
                <span className="text-muted-foreground text-right">
                  {pattern ? `${pattern.name} · ${formatPhases(pattern)}` : "—"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="about-mascot">
        <h2 id="about-mascot" className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          The mascot
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Brume is the mist sprite at the centre of the orb — it breathes the
          same eased curve you do. It watches when you arrive, shelters when
          the word is heavy, and hops only when things feel light.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="about-room">
        <h2 id="about-room" className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          The room
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          Behind everything is one room — the feeling made weather. Six
          materials hold the word you bring: {materials}. Waves and snow carry
          a quiet sound bed; the rest stay silent.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="about-promises">
        <h2 id="about-promises" className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          What it never does
        </h2>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          No camera. No scores. No streaks. Nothing about you is measured
          or inferred. Breath cues play from files on this device. Two
          moments use our voice service, and both wait for you to ask:
          tapping "say it" sends a little audio while you speak, so Brume
          can offer the closest word, and asking to hear a line sends that
          line to be spoken back. Nothing from either is recorded — the
          words are matched and dropped. Nothing else leaves.
        </p>
      </section>

      <p className="mt-14 text-center">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </Link>
      </p>
    </div>
  );
}
