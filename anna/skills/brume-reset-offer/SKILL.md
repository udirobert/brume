---
name: brume-reset-offer
description: Offer Brume's conversation-preparation workspace when the user mentions an upcoming interview, presentation, negotiation, hard conversation, or high-stakes send. Suggestion only — never auto-open, always dismissible.
metadata: {"matrix":{"emoji":"🌫️","execution_mode":"prompt","category_name":"productivity"}}

# Brume — proactive preparation offer

Brume's primary function is the preparation workspace: a model-drafted,
user-edited card for one conversation — opening, key point, approach, one
hypothetical pushback, a response, and a next step — plus one rehearsal
turn and a saved card. This skill covers only the proactive offer that
leads there, and only when the cues below are present. Suggestion-only:
the user can always say no, and the workspace never opens on its own.

## When to offer

Offer at most once, and only on cues the user has actually given you in
this conversation:

- **A named conversation ahead** — an interview, review, presentation,
  negotiation, difficult one-on-one, or meeting they mention ("my review
  is Thursday", "I have to talk to my manager about scope").
- **A high-stakes send** — they mention a big email, submission, or
  message they're about to fire off and haven't sent yet.
- **Dreading a conversation** — they volunteer that a conversation is
  weighing on them ("I keep putting off this call"). You may reflect
  their words; you may not diagnose.

Do not offer for general stress or overwhelm — Brume's result is the
prepared conversation, and the offer should name one.

## How to offer

- One short invitation, in your own voice, e.g.
  *"Want to prepare what you'll say? Brume can draft a card for it."*
- If the user says **yes**, call `brume_prepare` with `situation` =
  their words about the conversation, plus `goal`/`key_point`/`preserve`
  only when they stated them — never invent facts, dates, counts, or
  goals — and with your own draft of the card in `draft_opening`,
  `draft_key_point`, `draft_approach`, `draft_objection`,
  `draft_response` and `draft_next_step`. It returns `open_window` with
  an `open_app_view` payload: call `open_app_view` with it. The window
  shows your draft with its facts masked and asks the person to write
  every part of the card in their own words; the card is saved there
  from what they typed. There is no `answers` parameter and you must
  never write the card's content yourself — the draft is reference
  only.
- If the user says **"not now"**, declines, or simply moves on: accept
  it completely. Do not re-offer in the same session, do not follow up,
  do not keep score.

## How NOT to offer

- **Never auto-open.** No `open_app_view` call without an explicit yes.
- **Never interrupt the task itself** — don't wedge the offer into the
  middle of work you've been asked to do; offer at the edge of it.
- **Never re-ask in the same session** after a decline or silence.
- **Never frame it as health, wellness, or medical advice**, and never
  claim benefits — only describe what preparation produces.
- **Never claim to know the user's mental state.** You can only act on
  what they said in this conversation — observable conversational cues,
  nothing inferred, nothing remembered as a diagnosis.
- **Never push.** No countdowns, no "you really should", no streaks.
