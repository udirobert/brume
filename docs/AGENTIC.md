# Should Brume be agentic?

Decision note, 2026-11-02. Short answer: **not the web app; yes, carefully, inside Anna.**

## Web app: no

- The product's value is the absence of demands: nothing to get right, nothing to prove. An agent that learns patterns, nudges, or adapts sessions drifts back into coach and dashboard territory, which we removed on purpose (no camera, scores or streaks).
- The wedge that justified an agent layer (selling "proof of practice" to other agents, built on camera verification) is retired. A face in frame proves nothing; see `docs/STRATEGY.md` (superseded).
- `src/lib/ai` is small and barely used (one hook outside it) and was built around claims we no longer make.
- Check-ins are sensitive. Today the check-in is a local lookup plus a sentence the user edits, and nothing leaves the page unless they choose to share it. An LLM in that loop adds retention, prompt-injection and edge-case risk, and makes the no-health-claims rule (`src/lib/__tests__/copy-claims.test.ts`) much harder to enforce on generated text than on string tables.

## Anna: yes, inside these limits

Anna is where Brume sits inside someone's workflow, and the Founding Builder Program requires an AI-native core, so the agent is the delivery channel there, not the experience.

- **Proactive in suggestion only.** The agent may offer a reset from cues the user can see ("you usually pause before writing"). It never auto-starts and never interrupts. Every offer is dismissible, and the product works fully if the user never accepts one (`docs/ANNA.md` §6a).
- **AI drafts, the user decides.** Preparation drafts are editable; model output is validated and filtered (health-claim and cue filters in `anna/bundle/plan.js` / `preparation.js`).
- **No scores, streaks or camera — and no microphone in this surface.** The web app's bounded check-in microphone (one sentence per hold or tap, nothing recorded) does not carry into Anna; nothing here captures audio. Same content rules as the web app (`AGENTS.md`, "We do not sense you").

## Agent-friendly, not agentic

Keep resets, the Decompress pause and the one-sentence message small, callable tools (as `brume_reset` already is for Anna), so any assistant can send someone into the room. Brume stays a quiet room.

## Optional later: AI-written check-in sentence (web)

Only if we see people stuck at "put it into words". Opt-in, a draft the user edits, send only the label they picked (never their text), and run the output through the banned-claims list.

## What would change this

Evidence that people want Brume to initiate, for example many users saying they forget to take breaks. Even then, the first step is a quiet reminder the user schedules, which needs no agent.
