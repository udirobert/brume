# Brume — Launch & Distribution Playbook

**Date:** 2026-11-04
> **Status (current phase = B2C web experiments):** only the web app is
> live. Section 2 (Cloudflare Worker MCP deploy, ChatGPT Apps directory,
> Claude Desktop) is **ON HOLD** — nothing is deployed or submitted until a
> cohort of web users enjoys the app and retention is proven. See
> `docs/EXPERIMENTS.md` ("Bar for going live"). The copy below is kept
> ready, not scheduled. Sections 1, 3 and 4 are independent of that gate.

**TL;DR:** Copy-ready submissions, essays, and launch assets for Brume's immediate acquisition and retention channels:
1. **AssemblyAI Voice Hackathon** (Deadline: Nov 7, 11:00 AM PT)
2. **Cloudflare Worker MCP Deploy + ChatGPT Apps Directory / Claude Desktop**
3. **DEV.to / Hacker News Engineering Post** ("Why we removed the camera, the streaks, and the health claims")
4. **Product Hunt Launch Copy** (Late November MAU push)

---

## 1. AssemblyAI Voice Hackathon Submission (Due Nov 7, 11:00 AM PT)

**Form:** `https://forms.gle/XCW2RdZGbarVLnKEA`

### Project Title
**Brume Speaks — Whisper, Not Narration: Eyes-Closed Breathing Cues**

### Tagline (One Sentence)
A quiet breathing companion that speaks only the phase words you need so you can close your eyes for 90 seconds—no accounts, no streaks, no scores, and no chatty AI narration.

### Problem & Solution (Submission Description)
Most voice AI products compete on how much they talk to you (conversational coaches, 20-minute guided meditations, or therapeutic chatbots). When you are overwhelmed between meetings or stretched thin after work, explaining yourself to a conversational AI is the last thing you want to do—and staring at a screen timer keeps your eyes open.

**Brume** takes the opposite approach: **whisper, not narration.**

1. **Tap how the moment feels** (using our paired-feeling chips like *Light / Heavy*, *Settled / Restless*, *Energised / Drained*), and the WebGL room and mist-sprite mascot immediately shift colour, density, and demeanour to hold that weight with you.
2. **Close your eyes:** With **Brume Speaks** (`spoken` cue mode), high-clarity spoken phase cues synthesized with **AssemblyAI Text-to-Speech** (`scripts/generate-voice.mjs` → `public/voice/*.wav`, with Web Speech API fallback) guide each inhale, hold, and exhale so you never have to look at the screen.
3. **Put it into words:** After 90 seconds, Brume helps you compose one honest, low-pressure sentence to copy or send to someone close or a teammate (*"Heads up: I'm carrying a lot today. Listening would help; I don't need it solved."*)—optionally attaching a zero-tracking quiet room link (`?via=invite`) so they can take two minutes too.

**Disclosure of pre-existing codebase:** Brume's core breathing clock and UI existed prior to the hackathon; built specifically during the hackathon window were the **AssemblyAI TTS voice generation pipeline** (`scripts/generate-voice.mjs`), the in-session spoken audio engine (`src/lib/spokenCues.ts`), the `spoken / breath / off` audio selector on Home, and the eyes-closed accessibility flow.

### Social Post (LinkedIn / X — Extra Judging Points)
> Every voice AI wants to have a conversation with you.
>
> When you're overwhelmed between meetings, explaining yourself to a chatbot is the last thing you want. You just want to close your eyes for 90 seconds.
>
> For the @AssemblyAI Voice Hackathon, we built "Brume Speaks" — whisper, not narration.
>
> - Tap how you feel (the WebGL mist room + sprite shift to match)
> - Close your eyes while AssemblyAI TTS guides each breath phase
> - Leave with one honest sentence to send to your team or partner
>
> No camera. No streaks. No scores. Nothing to prove.
>
> Try the room: https://brumeapp.netlify.app

---

## 2. MCP Server — Cloudflare Worker Deploy & Directory Submission

### Deploy to Cloudflare Workers (Free Tier)
`mcp/` now includes a zero-dependency stateless Cloudflare Worker (`mcp/worker.js` + `mcp/mcp-core.js` + `mcp/wrangler.toml`) that serves the exact same `anna/bundle/plan.js` contract and inlined mist-sprite widget (`ui://widget/brume-session.html`).

```bash
cd mcp
npm test                  # builds widget-bundle.js + runs all 19 contract/DOM/worker tests
npx wrangler deploy       # deploys to https://brume-mcp.<your-subdomain>.workers.dev
```

### Copy-Paste Config for Claude Desktop / Cursor / Windsurf Users
Share this snippet in the repo README and launch posts so developers can add a 90-second reset tool directly inside their coding workflow:

```json
{
  "mcpServers": {
    "brume": {
      "url": "https://brume-mcp.<your-subdomain>.workers.dev"
    }
  }
}
```

### ChatGPT App Directory Listing Copy
* **Name:** Brume
* **One-line description:** A quiet room your AI can send you into for a 60–180 second breathing break.
* **Description:** Tell ChatGPT what you're about to do ("big call in 10 minutes", "fried after debugging") and ask for a Brume reset. Brume validates a rhythm-only breathing plan (**Cyclic sigh**, **Long exhale**, **Box**, or **Steady**) and opens a self-contained mist-sprite widget right in the chat. No accounts, no scores, no streaks, and no health or medical claims—every cue is filtered to describe rhythm and posture only.

---

## 3. DEV.to / Hacker News Engineering Essay

### Title Options
1. **Why we removed the camera, the streaks, and the health claims from our breathing app**
2. **Building an "anti-wellness" app: deterministic SVG sprites, WebGL mist, and regex-enforced honesty**

### Draft Body
```markdown
95% of users abandon meditation and breathing apps within weeks.

When we looked at why—and looked honestly at our own earlier prototype—the culprits were obvious:
1. **Content overload:** Nobody who is overwhelmed at 3:15 PM wants to browse a Netflix-style library of 500 audio tracks.
2. **Gamification guilt:** Streaks and "stillness scores" turn recovery into another KPI you can fail at.
3. **Surveillance & overclaiming:** Earlier this year, our app used a webcam to "verify" stillness and quoted neuroscience claims about cortisol and the vagus nerve.

Last month, we tore all of that out.

### 1. Replacing the webcam with two-way pointer physics (`hush`)
A face in a webcam frame proves nothing about whether a person is actually resting. Worse, asking for camera permission right when someone feels stretched thin destroys trust.

Instead of watching the user through a camera, we made our mist-sprite mascot (`anna/bundle/mascot-engine.js`) respond to **how you approach it**:
- The mascot runs on a pure, deterministic frame sampler (`sampleMascot(t, opts)`) shared across our React web app, our Anna app bundle, and our self-contained MCP widget.
- We track an exponential moving average (EMA) of pointer velocity near the sprite (`hush` input). If your cursor is agitated and darting around the screen, Brume doesn't speed up—it **quiets its bob, gaze drift, and glances down to model stillness**.
- If you rest your cursor gently near it for 0.6 seconds, it performs a three-act `settle` reaction with you once per approach.

### 2. Enforcing "no health claims" in CI (`copy-claims.test.ts`)
Wellness apps love promising that a 4-7-8 breath will "activate your parasympathetic nervous system" or "lower cortisol." Even when based on real papers (like Balban et al. 2023 on cyclic sighing), translating lab group averages into per-session promises inside an app is dishonest.

So we wrote a test (`src/lib/__tests__/copy-claims.test.ts`) and a shared validator (`HEALTH_CLAIM_RE` in `anna/bundle/plan.js`) that fails the build—and strips LLM tool outputs at runtime—if any string mentions:
`proven | scientific | nervous system | anxiety | insomnia | immune | cortisol | vagus | stress relief | sleep quality | energy boost | parasympathetic | biometric`

Every rhythm in Brume is described **only by its timing and feel** ("Double inhale, long exhale — when you're carrying a lot").

### 3. "Say it without explaining it"
Often, taking a two-minute breath isn't the hard part—telling your partner or your team on Slack that you're at capacity *without* starting a 20-minute explanation is.

At the end of a session, Brume offers a 1-sentence composer built from your check-in word and who it's for:
> *"Heads up: I'm carrying a lot today. Listening would help; I don't need it solved."*

Nothing leaves the page unless you copy or share it—and if you toggle **"Include a quiet room link"**, it appends a zero-tracking `/session?pattern=reset&via=invite` link so the recipient gets two quiet minutes too.

### 4. One engine across Web, Anna, and MCP
Because Brume is a quiet room rather than a content library, we packaged the session engine as an MCP server (`mcp/worker.js`) in under 300 lines of code. Any MCP-compatible agent can call `brume_reset` and render the inline SVG mist sprite directly inside the chat.

Try the room (no login, no camera, no streaks): https://brumeapp.netlify.app
```

---

## 4. Product Hunt Launch Copy (Late November Push)

* **Tagline:** A quiet room for the two minutes between things.
* **Subtitle:** Guided breathing + one honest sentence to share. No camera, no streaks, no scores.
* **Maker's First Comment:**
  > Hey Product Hunt! 👋
  >
  > Most wellness apps are either massive audio libraries you have to browse (Calm, Headspace) or habit trackers that make you feel guilty when you miss a day.
  >
  > We built **Brume** (`brumeapp.netlify.app` and `#brume` on Anna) for the two minutes *between* things—before a hard conversation, between back-to-back calls, or right after work.
  >
  > **What makes Brume different:**
  > 1. **Paired-feeling check-in:** Tap a chip (*Light / Heavy*, *Settled / Restless*, *Connected / Lonely*)—tap again to flip to its opposite. The WebGL room and Brume (our mist sprite) shift colour, weight, and demeanour to sit with you.
  > 2. **The breath offers its own ending:** Past 90 seconds, the next inhale boundary gently offers to rest (*"the breath can rest here"*).
  > 3. **Put it into words:** Leave with one honest, editable sentence you can copy to Slack or text to someone close (*"I'm a little stretched today. A little space would help."*), with an optional link to pass a 90-second break on.
  > 4. **Zero surveillance, zero gamification:** No camera, no microphone required, no streaks, no scores, and no medical/hormone claims.
  >
  > Let us know how the room feels—and which feeling pair resonates most with you today!
