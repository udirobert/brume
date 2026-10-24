# Hacktoberfest 2026 — Week 3 "Slow and Steady" submission draft

> Draft for a DEV post. Submission due 2026-10-25.
> Suggested tags: `#devchallenge` `#hf26challenge`
> Live demo: https://brumeapp.netlify.app
> Repository: https://github.com/udirobert/brume (MIT)

---

# Brume: a small breathing break between one thing and the next

Brume is a guided breathing app built around a simple idea: a useful pause
should be easy to start and easy to leave. Open the web app, choose a reset,
and follow a visual breathing rhythm. You can begin without an account, and
camera feedback is optional.

I built Brume for the small transitions in a day — before a call, after a long
stretch of work, or whenever a person wants a moment to pause. It is a
non-clinical practice tool, not a way to diagnose stress or measure whether
someone is breathing correctly.

## What the web app does today

- **Start with a simple reset.** The home screen offers a 4-in, 6-out reset,
  with mood-based suggestions and other rhythms available as alternatives.
- **Choose whether to use the camera.** The breathing session works without
  camera access. If a user opts in, image frames are sent to Brume's backend
  for MediaPipe face-landmark and movement estimates. Those estimates are
  optional feedback; they do not verify breathing or indicate a health state.
- **Keep a local session record.** Guest sessions are stored on the device.
  When the network is available, the app can attempt to sync session data.
- **Use optional AI analysis.** The repository includes server-side AI
  analysis integrations. Availability depends on backend configuration; the
  breathing timer and basic patterns do not require an AI request.

The web app currently defines seven built-in breathing patterns. I avoid
claiming the full interface works offline after the first visit: session data
has offline-friendly local storage, but the repository does not register a
service worker to cache the whole app shell.

## Open source, privacy, and trade-offs

Brume is MIT-licensed. Its web client uses React, TypeScript, and Vite; its
optional vision service uses MediaPipe in the backend. The project also
contains server-side integrations for several AI providers, including
Cerebras and Gemini. Those provider adapters do not mean every session uses
an open-weight model, or that AI runs on the user's device.

One lesson from building this is that "open source" and "private by default"
are different claims. Camera feedback is opt-in, and the disclosure appears
before the camera control: frames go to the backend for processing. The
camera-free practice is available for anyone who would rather not send
frames.

## Building with GitHub Copilot

I built Brume with GitHub Copilot in VS Code, using inline suggestions, chat,
and agent mode while working on the breathing-pattern logic, camera-feedback
flow, and FastAPI vision service. The repository's GitHub Actions workflow
runs lint, type-check, unit tests, backend lint, and a production build for
pushes and pull requests to `main`. Dependabot is configured for weekly
dependency and GitHub Actions updates.

I'm entering the GitHub Copilot category based on that development
experience. The project also uses open-source components and has an MIT
license, but I don't claim that the entire AI stack is open-weight or
self-hosted.

## Demo and code

- Live demo: https://brumeapp.netlify.app
- Source code and setup: https://github.com/udirobert/brume
- License: [MIT](../LICENSE)

## Tech stack

React, TypeScript, Vite, Tailwind CSS, FastAPI, MediaPipe, Supabase for
optional account-backed persistence, and GitHub Actions. Optional AI analysis
is served through backend provider integrations; it is not required for a
basic breathing session.

## What I'd improve next

- Make the session experience and offline boundaries clearer, including
  exactly which parts remain available without a network.
- Continue simplifying the first-use flow so the breathing break feels calm,
  quick, and easy to understand.

---

*Draft for Hacktoberfest 2026 Week 3 — "Slow and Steady". Verify the live demo
and submission requirements before publishing.*
