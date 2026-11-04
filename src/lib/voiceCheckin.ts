/**
 * Voice check-in — "Just say it." Speak a feeling word instead of tapping.
 *
 * Capture is a short MediaRecorder clip POSTed to /api/stt (AssemblyAI on
 * the server); the browser's SpeechRecognition is the fallback path. The
 * transcript is matched against the 14-feeling catalog — the word you
 * said never leaves this page as data, only the chosen index.
 */

import { FEELINGS, pairForFeel } from "./feelings";

const STT_ENDPOINT = import.meta.env.DEV
  ? "/api/stt"
  : `${import.meta.env.VITE_HETZNER_SERVICE_URL ?? ""}/api/stt`;
const LISTEN_MS = 4000;

// Colloquial words → feeling index (labels/phrases already covered).
const SYNONYMS: Record<number, string[]> = {
  0: ["ok", "fine", "alright", "okay"],
  1: ["tense", "tight", "stressed", "stress", "stretched"],
  2: ["busy", "racing", "scattered", "much"],
  3: ["edge", "brink", "burning", "burnt", "limit"],
  4: ["swamped", "drowning", "overwhelming"],
  5: ["good", "great", "easy", "breezy"],
  6: ["down", "low", "sad", "blue", "gloomy"],
  7: ["pumped", "buzzed", "alive", "energy", "energized"],
  8: ["tired", "exhausted", "sleepy", "fatigued", "empty", "wiped"],
  9: ["calm", "peaceful", "content", "grounded", "steady"],
  10: ["fidgety", "anxious", "wired", "jumpy", "antsy"],
  11: ["close", "loved", "warm", "together"],
  12: ["alone", "isolated", "lonesome"],
  13: ["hope", "optimistic", "bright", "upbeat"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/** transcript → feeling index, or null when nothing matches. */
export function matchFeeling(transcript: string): number | null {
  const t = norm(transcript);
  if (!t) return null;
  const words = new Set(t.split(" "));
  let best: { index: number; score: number } | null = null;
  for (let i = 0; i < FEELINGS.length; i++) {
    const f = FEELINGS[i];
    let score = 0;
    if (t === norm(f.label) || t === norm(f.longLabel)) score += 4;
    else if (t.includes(norm(f.label)) || t.includes(norm(f.phrase))) score += 3;
    for (const w of norm(f.phrase).split(" ")) if (w.length > 3 && words.has(w)) score += 1;
    for (const w of SYNONYMS[i] ?? []) if (t.includes(w)) score += 2;
    if (score > 0 && (best === null || score > best.score)) best = { index: i, score };
  }
  return best?.index ?? null;
}

export function voiceCheckinSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(
    (typeof navigator.mediaDevices?.getUserMedia === "function" &&
      w.MediaRecorder) ||
    w.SpeechRecognition || w.webkitSpeechRecognition
  );
}

export interface HeardResult {
  transcript: string;
  index: number | null;
}

async function viaAssemblyAI(onInterim?: (s: string) => void): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  try {
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.start();
    onInterim?.("listening…");
    await new Promise((r) => setTimeout(r, LISTEN_MS));
    rec.stop();
    await stopped;
    const res = await fetch(STT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: new Blob(parts, { type: rec.mimeType || "audio/webm" }),
    });
    if (!res.ok) throw new Error(`stt ${res.status}`);
    const { text } = (await res.json()) as { text: string };
    return text ?? "";
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

function viaWebSpeech(onInterim?: (s: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return reject(new Error("no_speech_api"));
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let final = "";
    rec.onresult = (e: any) => {
      const t = e.results[e.results.length - 1][0].transcript;
      if (e.results[e.results.length - 1].isFinal) final = t;
      else onInterim?.(t);
    };
    rec.onerror = () => reject(new Error("speech_error"));
    rec.onend = () => resolve(final);
    onInterim?.("listening…");
    rec.start();
  });
}

/** One shot: listen → transcribe → match. Returns the heard words too. */
export async function listenOnce(
  onInterim?: (s: string) => void,
): Promise<HeardResult> {
  let transcript = "";
  try {
    transcript = await viaAssemblyAI(onInterim);
  } catch {
    transcript = await viaWebSpeech(onInterim).catch(() => "");
  }
  return { transcript, index: matchFeeling(transcript) };
}
