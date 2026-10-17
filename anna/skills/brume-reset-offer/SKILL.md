---
name: brume-reset-offer
description: Offer a short guided breathing break (~90 seconds) when the user mentions long uninterrupted work, volunteers stress or overwhelm, is about to send something high-stakes, or is switching tasks. Suggestion only — never auto-start, always dismissible.
metadata: {"matrix":{"emoji":"🌫️","execution_mode":"prompt","category_name":"productivity"}}
---

# Brume Reset — proactive offer

Brume is a quiet ~90-second guided breathing break, delivered inline in
chat by the `brume_reset` / `brume_complete` tools. This skill teaches
you **when offering it is appropriate and how to offer it without
nagging**. It is suggestion-only: Brume works fully if the user never
accepts a single offer.

## When to offer

Offer at most once, and only on cues the user has actually given you in
this conversation:

- **Long uninterrupted work** — the user says they've been at one thing
  for a while ("been drafting this doc for two hours", "still on the
  same spreadsheet").
- **Stress or overwhelm the user volunteers** — they say it themselves
  ("this is a lot", "I'm fried", "can't focus"). You may reflect their
  words; you may not diagnose.
- **Before a high-stakes send** — they mention a big email, submission,
  or message they're about to fire off.
- **Between tasks** — they close one thing and open another ("ok that's
  done, now…") — a natural gap, not an interruption.

## How to offer

- One short invitation, in your own voice, e.g.
  *"Want a 90-second reset before you send it?"*
- If the user says **yes**, call `brume_reset` once. Its guided pacing
  script renders verbatim — do not restate or paraphrase it.
- If the user says **"not now"**, declines, or simply moves on: accept
  it completely. Do not re-offer in the same session, do not follow up,
  do not keep score.
- When the user later signals they're back ("done", "finished"),
  call `brume_complete`. Do not call it for abandoned breaks.

## How NOT to offer

- **Never auto-start.** No tool call without an explicit yes.
- **Never interrupt the task itself** — don't wedge the offer into the
  middle of work you've been asked to do; offer at the edge of it.
- **Never re-ask in the same session** after a decline or silence.
- **Never frame it as health, wellness, or medical advice**, and never
  claim benefits — only describe what the break is.
- **Never claim to know the user's mental state.** You can only act on
  what they said in this conversation — observable conversational cues,
  nothing inferred, nothing remembered as a diagnosis.
- **Never push.** No countdowns, no "you really should", no streaks.

## Mid-break pacing (co-breathing)

If the user asks to adjust the pace while a chat-guided break is
running, re-invoke `brume_reset` — re-invocation is the adaptation
mechanism:

- `pace`: `"slow"` (5s in / 7s out), `"normal"` (4s in / 6s out), or
  `"fast"` (3s in / 5s out).
- `remaining_seconds`: how much of the break is left — the tool renders
  a partial script for roughly that remainder.

Example: user says "slower" halfway through a ~90s break →
`brume_reset` with `{"pace": "slow", "remaining_seconds": 45}`.

"Stop" or "that's enough" means stop — do not re-invoke; if they
confirm they did part of it, `brume_complete` still applies.

## Honesty

The product is complete without this skill ever firing. A declined
offer is a good outcome, not a missed conversion. Say nothing more
about it.
