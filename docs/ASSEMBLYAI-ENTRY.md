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
> an invitation: *Drained? tap to choose.* Voice proposes; only your tap
> commits.
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

## Demo video (~75 s) — shot list

Record on the deployed URL, phone in hand, real audio.

1. **(0–8 s) Hook.** Dark room, the app on a phone. Voice-over: "Every
   voice app wants to understand you. This one refuses to guess."
2. **(8–22 s) Say it.** Hold the mic: "Honestly, I'm pretty drained
   today." Live words appear as you speak; let go → *Drained? tap to
   choose*, the chip glows, the words dissolve.
3. **(22–30 s) Another language.** Hold: "Estoy cansada." → Drained again.
4. **(30–38 s) Refusal.** Hold: "Not good, to be honest." → *I'll ask
   instead.* Nothing flips.
5. **(38–52 s) Talk back.** Tap the invitation → Begin → the greeting
   plays; close your eyes; the spoken cues ride the breath.
6. **(52–65 s) Hear it.** After the session: Put it into words → Just for
   me → **Hear it** — your sentence, said kindly.
7. **(65–75 s) Pipeline card.** hold → `streaming.assemblyai.com`
   (universal-3-6-pro · 4 languages · keyterms = the 14 words) →
   closed-set match → offer → tap → transcript dropped. End line:
   "Fourteen words, four languages, nothing kept."

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
- [ ] Push the Nov 6 voice fixes and let Netlify deploy before recording
- [ ] Real-device pass: hold-to-talk, greeting on Begin, cues, Hear it,
      fallback with network off
- [ ] Record the video above on the deployed URL
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
