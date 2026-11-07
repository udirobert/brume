# AssemblyAI "Hack into speech" — the entry

Deadline **Nov 7, 2026, 11:00 AM PT**. Submit: Google Form
(forms.gle/XCW2RdZGbarVLnKEA). $2,000 across 20 winners. Themes: in-app
assistants that talk back; accessibility. Extra credit: their agent
builder, and a LinkedIn/X post tagging AssemblyAI.

This file is the one source for the submission. `docs/LAUNCH-PLAYBOOK.md`
§1 and `docs/DISTRIBUTION.md` point here; the older "Brume speaks /
whisper, not narration" draft is folded into the description below.

## Title

**Brume — a voice that can't misread you**

## One-liner

A ninety-second breathing room that listens for one sentence, proposes
one of fourteen words and waits for your tap — then speaks back in a
whisper so you can close your eyes.

## Description (paste-ready)

> Every voice product wants to understand you. Brume is built the other
> way: it hears you completely and refuses to guess.
>
> Brume is a small room you visit for ninety seconds to breathe. It asks
> one question — *how are you feeling?* — and you can tap a word or just
> say it. Hold the mic, talk the way you would to a friend ("honestly,
> I'm pretty drained today"), let go.
>
> **Listening, bounded.** Your words stream live to AssemblyAI's
> Universal-Streaming (`universal-3-6-pro`, PCM16 over
> `wss://streaming.assemblyai.com`), with turns joined so a pause
> mid-sentence never loses the feeling word. The recognizer is primed
> with `keyterms_prompt` set to exactly the fourteen words Brume may
> propose, and `language_codes` lets it code-switch across English,
> Spanish, French and German ("estoy cansada" → Drained). Then the
> transcript is matched to that closed catalog — whole words only, so
> "hopeless" is never Hopeful — and the nearest word turns face-up with
> an invitation: *Drained — tap to keep it.* Voice proposes; only your
> tap commits.
>
> **Refusal you can see.** Say "not good" and Brume doesn't flip it to a
> sad word or a happy one — it says *I'll ask instead* and waits.
> Whatever it heard dissolves into the mist on screen a few seconds
> later. No audio is recorded, no transcript is stored, nothing is sent
> to a language model, and there is no sentiment score. We deliberately
> declined LLM and sentiment features: interpreting a feeling is the one
> mistake this product can't afford.
>
> **Talking back, gently.** AssemblyAI's TTS carries Brume's own voice:
> pre-rendered breath cues ("Breathe in … Hold … Breathe out") so a
> session works with your eyes closed; one line from Brume's side of the
> room when you begin ("Evening. Nothing to finish tonight. Just the long
> exhale."), synthesized live from a closed table — never your words
> handed back; and **Hear it**, which reads the one sentence you wrote
> after the session aloud — to someone else, or kept just for you.
>
> **Built to be trusted.** The API key stays on our server (FastAPI,
> `/api/stt-token` + `/api/tts`); the browser gets a short-lived
> streaming token. Per-visitor and daily limits bound the cost, text is
> never logged, and every failure degrades: the stream falls back to a
> clip upload, then to the browser's own recognition; the voice falls
> back to the browser's own speech. A blocked microphone gets the actual
> fix for your device, and every card ends with *or just tap a word*.
>
> Built on an existing project — Brume, a calm breathing app — with the
> whole voice layer added during the hackathon window. The repo is
> public: github.com/udirobert/brume.

Soundbite: *"We primed the recognizer with a fourteen-word grammar,
code-switched across four languages, joined the turns the pauses tried to
split — and built the product that makes refusing to understand visible."*

## Disclosure — what existed, what was built in the window

From git history (window Oct 27 – Nov 7; all voice files are first
committed Nov 2–5):

- **Before the hackathon:** the breathing sessions and clock, the WebGL
  room, the mascot, the fourteen-word paired check-in chips, the
  post-session words card.
- **Built during it:** AssemblyAI-rendered breath cues
  (`scripts/generate-voice.mjs` → `public/voice/`) and the cue engine
  with its spoken / breath / quiet chooser (`src/lib/voiceCues.ts`); the
  session greeting (`src/lib/spokenGreeting.ts`) and live `/api/tts` on
  the server (plus its Netlify and dev twins); the streaming voice
  check-in (`src/lib/voiceCheckin.ts` — token, Universal-Streaming,
  turn joining, closed-set matching, negation refusal, multilingual
  aliases, clip and browser fallbacks) and its mic UI in
  `src/components/checkin/PairedFeelings.tsx`; the cost guard
  (`backend/vision-service/voice_guard.py`); "Hear it" on the words card.

## Social post (LinkedIn / X — extra credit)

> Every voice AI wants to understand you. We built one that refuses to
> guess.
>
> For the @AssemblyAI Voice Hackathon: Brume, a 90-second breathing room.
> Hold the mic and say how you feel, in English, Spanish, French or
> German. AssemblyAI's streaming STT is primed with exactly fourteen
> words; Brume proposes one and waits for your tap.
>
> Say "not good" and it answers "I'll ask instead". Your words dissolve
> on screen. Nothing recorded, nothing kept, no sentiment score.
>
> Then AssemblyAI TTS whispers the breath cues so you can close your eyes.
>
> Try the room: https://brumeapp.netlify.app

## Demo video

**`SECOND_WIND_hackathon_v2.mp4`** — 2:43, 1920×1080, 30 fps. A three-act
spy-caper short that ends on a live capture of the product. Video files
and renders stay out of git (`.gitignore`); the shot list and provenance
live in `gen-logs/film_v1.json`.

The film argues the thesis in three refusals, then proves it:

- **Act I (0:00–0:30) — the storm.** Badge-shuriken title → notification
  rain → scroll river → chat fire → 2 a.m. bed. Everyone drowning in the
  same private feed.
- **Act II (0:30–1:26) — the ritual.** The relic, then the real thing:
  the shipped mascot engine, the transcript dissolving, *A LOT* proposed
  and waiting for a tap, the settle, the koan in AssemblyAI's own voice.
  Then the twenty-second bubble: the companion breathing while chaos
  cards bounce off the edge.
- **Act III (1:26–2:16) — the copycat fails.** Plaza overwhelm → the ninja
  at the center of the storm → *drained* → the bubble scaled → a copycat
  tries the technique on "I'm NOT stressed", gets *I'll ask instead*,
  and walks away mid-proposal. The honest message card, then the secret
  he never tells.
- **Button (2:16–2:23).** End card: *hear one sentence. never keep it.*
- **Proof (2:23–2:43).** A slate — *the real thing, a live check-in* —
  cuts to a screen recording of the deployed app: Chromium's fake mic fed
  a spoken "I've got a lot on my mind", the real `.brume-mic` held, the
  live AssemblyAI streaming recognizer returning the transcript, the
  proposal *A lot — tap to keep it*, the tap on camera, and the room
  settling into the reason chips and *private · stays on this device*.
  No mock and no staged UI: the product's actual voice pipeline, end to
  end. The score ducks under it so the evidence is audible.

The 59-second commercial in `docs/BRUME_CHROMA_AD_PRODUCTION.md` is a
separate, unshot piece aimed at the Chroma Awards; it is not this entry's
demo.

## Pre-submit checklist

- [x] `ASSEMBLYAI_API_KEY` on the Hetzner box; `/api/tts` and
      `/api/stt-token` verified from the public domain (Nov 6: token
      issued, TTS returns 24 kHz WAV)
- [x] Host nginx rate limit + app-level `voice_guard` (8/min/visitor,
      1500/day); TLS via certbot
- [x] `VITE_HETZNER_SERVICE_URL` in Netlify env — prod resolves
      `api.brume.trustfall.xyz`
- [x] Repo public (github.com/udirobert/brume)
- [x] End-to-end drive with real AssemblyAI streaming (Chrome fake mic
      fed with TTS sentences, Nov 6): drained / Spanish / negated /
      pause-joined / hopeless all behave as described above
- [x] Nov 6 voice fixes pushed to `main` (Netlify deploys on push) —
      reload the live app once before recording
- [ ] Real-device pass: hold-to-talk, greeting on Begin, cues, Hear it,
      fallback with network off
- [ ] Finish the film (`docs/BRUME_CHROMA_AD_PRODUCTION.md`) with real
      captures from the deployed URL
- [ ] Post on LinkedIn or X tagging AssemblyAI — link the deployed app
- [ ] Optional: their agent builder; `ASSEMBLYAI_API_KEY` in Netlify env
      (keeps the Netlify TTS twin live as a fallback)
- [ ] Fill the Google Form with the title, one-liner, description and
      disclosure above

## Local dev

`ASSEMBLYAI_API_KEY` in `.env.local` → `pnpm dev` serves `/api/tts`,
`/api/stt` and `/api/stt-token` through the vite middleware (same
contracts as production), so the dev check-in streams exactly like the
deployed one. Without a key, spoken lines fall back to the browser voice
and the check-in to the browser's recognition — cues are unaffected.
