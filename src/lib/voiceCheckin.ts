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

const TOKEN_ENDPOINT = STT_ENDPOINT + "-token";
const WS_URL = "wss://streaming.assemblyai.com/v3/ws";
const SILENCE_MS = 800;
const MAX_LISTEN_MS = 6000;

// Live path: stream PCM16 to AssemblyAI's realtime WS — transcripts
// arrive as we speak. Falls back to the file path on any failure.
async function viaStreaming(onInterim?: (s: string) => void): Promise<string> {
  const tok = await fetch(TOKEN_ENDPOINT, { method: "POST" });
  if (!tok.ok) throw new Error("no_token");
  const { token } = (await tok.json()) as { token: string };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ws = new WebSocket(`${WS_URL}?token=${token}&sample_rate=16000&format_turns=true`);
  let final = "";
  let silenceSince = 0;
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  src.connect(proc);
  proc.connect(ctx.destination);
  const heard = new Promise<string>((resolve, reject) => {
    const stop = (v: string) => {
      try { ws.close(); } catch {}
      resolve(v);
    };
    ws.onerror = () => reject(new Error("ws_error"));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "Turn" && m.transcript) {
        final = m.transcript;
        silenceSince = Date.now();
        if (!m.end_of_turn) onInterim?.(m.transcript);
        else stop(m.transcript);
      } else if (m.type === "Termination") stop(final);
    };
    proc.onaudioprocess = (ev) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const f32 = ev.inputBuffer.getChannelData(0);
      // 44.1k→16k naive decimation into PCM16
      const n = Math.floor(f32.length / 2.756);
      const pcm = new Int16Array(n);
      let peak = 0;
      for (let i = 0; i < n; i++) {
        const s = Math.max(-1, Math.min(1, f32[Math.floor(i * 2.756)]));
        peak = Math.max(peak, Math.abs(s));
        pcm[i] = s * 32767;
      }
      if (final && peak < 0.02 && Date.now() - silenceSince > SILENCE_MS) stop(final);
      else ws.send(pcm.buffer);
    };
    setTimeout(() => stop(final), MAX_LISTEN_MS);
  });
  try {
    return await heard;
  } finally {
    proc.disconnect(); src.disconnect(); ctx.close();
    stream.getTracks().forEach((t) => t.stop());
  }
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
    // Auto-stop on ~0.8 s of quiet after speech, hard cap 4 s.
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let spoke = false;
    let quietMs = 0;
    await new Promise<void>((resolve) => {
      const iv = setInterval(() => {
        an.getByteTimeDomainData(buf);
        let peak = 0;
        for (const b of buf) peak = Math.max(peak, Math.abs(b - 128) / 128);
        if (peak > 0.02) { spoke = true; quietMs = 0; } else quietMs += 100;
        if ((spoke && quietMs > SILENCE_MS) || (!spoke && quietMs > 2500)) {
          clearInterval(iv); resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(iv); resolve(); }, LISTEN_MS);
    });
    rec.stop();
    ctx.close();
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
    transcript = await viaStreaming(onInterim);
  } catch {
    try {
      transcript = await viaAssemblyAI(onInterim);
    } catch {
      transcript = await viaWebSpeech(onInterim).catch(() => "");
    }
  }
  return { transcript, index: matchFeeling(transcript) };
}
