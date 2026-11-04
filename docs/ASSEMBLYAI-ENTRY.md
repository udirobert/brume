# AssemblyAI "Hack into speech" — entry draft

Deadline **Nov 7, 2026, 11:00 AM PT**. Submit: Google Form
(forms.gle/XCW2RdZGbarVLnKEA). $2,000 across 20 winners. Themes: in-app
assistants that talk back; accessibility. Extra credit: their agent
builder, and a LinkedIn/X post tagging AssemblyAI.

## Entry: "Brume speaks"

**One-liner:** a breathing companion that says the least possible —
so you can close your eyes.

**Description (paste-ready, edit before submitting):**

> Every voice product wants to talk to you. Brume is built the other
> way: a little room you visit for ninety seconds, where the voice is a
> whisper — the minimum speech needed so a breathing reset works with
> your eyes closed.
>
> AssemblyAI's TTS carries the whole voice layer:
>
> - **Breath cues** — "Breathe in … Hold … Breathe out … Rest" —
>   rendered with the TTS API and shipped as a small cue library, so a
>   session needs no screen at all. (A gentler option swaps words for
>   breath-shaped sounds.)
> - **"Meet me where I am"** — when you tap Begin, Brume speaks one
>   line that names your moment — the time of day and the feeling you
>   checked in with ("Evening. You came in carrying a lot — we'll take
>   it slow."), synthesized live over the API.
> - **"Say it kindly"** — after a session you can write one sentence —
>   to yourself or to someone else — and *hear* it spoken back. Hearing
>   your own words said warmly lands differently than reading them.
>
> Live synthesis runs through our backend (`POST /api/tts` on the
> FastAPI service — the API key never ships in the bundle, input is
> capped at one sentence, text is never logged, nginx rate-limits the
> route). The browser's built-in voice is the graceful fallback,
> and spoken lines take priority over breath cues — one voice at a
> time.
>
> Built on an existing project — Brume, a calm breathing app — with the
> voice layer added for this hackathon. The repo is public; the diff is
> the work.

**Why it fits the brief:** assistants that talk back (Brume literally
talks back — your own words, said kindly), accessibility (eyes-closed,
hands-free use), and a deliberate counterpoint to always-on voice
agents: the product that needs the least of you.

## Demo video (~75 s)

1. (0–10 s) Dark room, app on a phone: "Brume is a little room to
   breathe. Today it learned to speak."
2. (10–25 s) Check in with a feeling ("A lot") → Begin → **the greeting
   plays**: "Evening. You came in carrying a lot — we'll take it slow."
   Screen can turn away — eyes closed.
3. (25–45 s) Session running: spoken cues at each phase edge; show the
   spoken/breath/off chooser + "hear it" audition on the preview.
4. (45–65 s) Post-session: write the sentence → tap **Hear it** → the
   card is read back. Beat of quiet.
5. (65–75 s) Code card: `/api/tts` → AssemblyAI TTS; fallback noted.
   "The least a voice can say, said well."

## Pre-submit checklist

- [ ] `ASSEMBLYAI_API_KEY` (+ optional `ASSEMBLYAI_VOICE_ID`) in
      `/opt/vision-service/.env` on the Hetzner box, then
      `pnpm deploy:vision` — the compose file passes both through;
      `curl -X POST $VITE_HETZNER_SERVICE_URL/api/tts` to confirm
- [ ] Set `ASSEMBLYAI_API_KEY` in Netlify env too — the function is the
      fallback path if `VITE_HETZNER_SERVICE_URL` is ever unset
- [ ] Real-device pass: greeting on Begin, cues, hear-it, fallback with
      network off
- [ ] Record the video above on the deployed URL (mic on, real audio)
- [ ] Post on LinkedIn or X tagging AssemblyAI (extra credit) — link the
      deployed app
- [ ] If time allows: their agent builder for extra credit
- [ ] Fill the Google Form; declare the pre-existing codebase in the
      description (already worded above)

## Local dev

`ASSEMBLYAI_API_KEY` in `.env` → `pnpm dev` serves `/api/tts` through
the vite middleware (same contract as the Netlify function). Without a
key, spoken lines fall back to the browser voice — cues are unaffected.
