#!/usr/bin/env node
// Offline generator for the pre-rendered "Brume speaks" breath cues.
// Keep CUES in sync with VOICE_CUES in src/lib/voiceCues.ts.
// Optional: set ASSEMBLYAI_VOICE_ID to render with a specific voice.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CUES = [
  { id: "inhale", text: "Breathe in" },
  { id: "hold", text: "Hold" },
  { id: "exhale", text: "Breathe out" },
  { id: "pause", text: "Rest" },
];

const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) {
  console.error("ASSEMBLYAI_API_KEY is required — export it before running.");
  process.exit(1);
}
const voiceId = process.env.ASSEMBLYAI_VOICE_ID;

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "voice");
await mkdir(outDir, { recursive: true });

let failed = 0;
for (const cue of CUES) {
  const body = { text: cue.text, container: "wav", stream: false };
  if (voiceId) body.voice_id = voiceId;

  const res = await fetch("https://tts.us.assemblyai.com/v1/speech", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`x ${cue.id}: HTTP ${res.status} ${await res.text()}`);
    failed++;
    continue;
  }

  const wav = Buffer.from(await res.arrayBuffer());
  await writeFile(join(outDir, `${cue.id}.wav`), wav);
  console.log(
    `ok ${cue.id}.wav (${wav.length} bytes)` +
      ` billed_chars=${res.headers.get("x-tts-billed-characters")}` +
      ` duration_ms=${res.headers.get("x-tts-audio-duration-ms")}`,
  );
}

process.exit(failed ? 1 : 0);
