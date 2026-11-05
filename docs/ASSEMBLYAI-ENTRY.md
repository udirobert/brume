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
> - **"Meet me where I am"** — when you tap Begin, Brume speaks one line
>   from its own side of the room: the hour, and what Brume does with it
>   ("Evening. Nothing to finish tonight. Just the long exhale."),
>   synthesized live over the API. It never repeats the word you checked
>   in with — a receipt isn't a companion.
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

## Update — Nov 5: the pitch deepened (use this framing)

A judge pass found "TTS carries the voice" too shallow: readable as
transcription-as-feature, replaceable. The pitch is now the *bounded
voice architecture* — voice input that cannot misread you:

- **Propose-never-commit voice** (named pattern): token →
  `wss://streaming.assemblyai.com` (PCM16, `universal-3-6-pro`) →
  turns joined → closed-set match → offer → tap → transcript dropped.
- **Multilingual check-in**: `language_codes=["en","es","fr","de"]`
  steers per-token with native code-switching; `LANG` alias catalogs
  in `voiceCheckin.ts` widen the match set, never the interpretation.
  *The closed catalog is what makes multilingual hearing safe.*
- **`keyterms_prompt`** biases the recognizer toward the exact words it
  may propose — the recognizer is primed by the grammar, not just
  filtered by it.
- **Legible refusal**: a negated transcript shows "I'll ask instead" on
  screen — the product declines interpretation, visibly.
- **Transcript dissolution**: heard words evaporate into the mist after
  the match — privacy rendered as animation.
- Turn detection tuned (`min_end_of_turn_silence_when_confident=600`,
  `max_turn_silence=1400`) after the demo shoot exposed mid-sentence
  clipping — shipped with a turn-join fix.
- EU data residency is a one-line claim: `streaming.eu.assemblyai.com`.
- Deliberately declined: LLM Gateway / sentiment / summarization —
  violates "never interpret a feeling". The refusal is the pitch.

Revised submission soundbite: *"Biased the recognizer toward a
fourteen-word grammar, code-switched across four languages, joined the
turns the pauses tried to split — and built the product that makes
refusing to understand visible."*

Video beats (supersedes below): hook ("voice that can't misread you") →
non-English line → Tense flips → "not good" → "I'll ask instead" →
transcript dissolves → breath cues ride the phase → pipeline card +
`streaming.assemblyai.com` flash → "Fourteen words, every language,
nothing kept."

**Why it fits the brief:** assistants that talk back (Brume literally
talks back — your own words, said kindly), accessibility (eyes-closed,
hands-free use), and a deliberate counterpoint to always-on voice
agents: the product that needs the least of you.

## Demo video (~75 s)

1. (0–10 s) Dark room, app on a phone: "Brume is a little room to
   breathe. Today it learned to speak."
2. (10–25 s) Check in with a feeling ("A lot") → Begin → **the greeting
   plays**: "Evening. Nothing to finish tonight. Just the long exhale."
   Screen can turn away — eyes closed.
3. (25–45 s) Session running: spoken cues at each phase edge; the spoken
   chooser + "hear it" audition on the preview, then the one glyph on the
   session — spoken → breath → quiet, mid-breath, no menu.
4. (45–65 s) Post-session: write the sentence → tap **Hear it** → the
   card is read back. Beat of quiet.
5. (65–75 s) Code card: `/api/tts` → AssemblyAI TTS; fallback noted.
   "The least a voice can say, said well."

## Pre-submit checklist

- [x] `ASSEMBLYAI_API_KEY` in `/opt/vision-service/.env` on the Hetzner
      box; full repo `main.py` deployed (previously ran an Oct-19 build
      missing siwe/revenuecat/sentry — now caught up; box verified:
      `POST /api/tts` → real WAV over HTTPS, empty → 400)
- [x] Host nginx: `limit_req` 10 r/s/burst 20 → 429 on
      api.brume.trustfall.xyz (mirrors api.famile.xyz); TLS via certbot;
      compose nginx service now profile-gated (`standalone`) since the
      host owns 80/443
- [x] `VITE_HETZNER_SERVICE_URL` confirmed in Netlify env (all scopes,
      all contexts) — prod resolves `api.brume.trustfall.xyz/api/tts`
- [ ] Optional: `ASSEMBLYAI_API_KEY` in Netlify env — keeps the Netlify
      function live as a fallback; without it that path 503s gracefully
      to the browser voice
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
