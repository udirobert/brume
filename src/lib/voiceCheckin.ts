/**
 * Voice check-in — "Just say it." Speak a feeling word instead of tapping.
 *
 * One tap listens for one sentence. Audio goes to AssemblyAI — streaming
 * PCM16 over the realtime WS, a POSTed clip to /api/stt as the fallback,
 * then the browser's SpeechRecognition. The transcript comes back, is
 * matched against the 14-feeling catalog, and is dropped: this module
 * stores no audio and no words. What a check-in records is the index you
 * confirm, and only once you confirm it — voice proposes, never commits
 * (AGENTS.md, "Doctrine for the check-in").
 */

import { FEELINGS, pairForFeel } from "./feelings";
import { voiceHeaders } from "./voiceKey";

const STT_ENDPOINT = import.meta.env.DEV
  ? "/api/stt"
  : `${import.meta.env.VITE_HETZNER_SERVICE_URL ?? ""}/api/stt`;
const LISTEN_MS = 4000;

// Colloquial words → feeling index (labels/phrases already covered).
const SYNONYMS: Record<number, string[]> = {
  0: ["ok", "fine", "alright", "okay", "neutral", "normal"],
  1: ["tense", "tight", "stressed", "stress", "stretched", "frustrated", "annoyed", "irritated", "pressure"],
  2: ["busy", "racing", "scattered", "much", "chaotic"],
  3: ["edge", "brink", "burning", "burnt", "limit", "breaking", "snapping"],
  4: ["swamped", "drowning", "overwhelming", "overloaded", "suffocating"],
  5: ["good", "great", "easy", "breezy", "happy", "glad", "lovely"],
  6: ["down", "low", "sad", "blue", "gloomy", "unhappy", "depressed", "miserable", "bad"],
  7: ["pumped", "buzzed", "alive", "energy", "energized", "excited", "thrilled", "hyper", "stoked", "joyful"],
  8: ["tired", "exhausted", "sleepy", "fatigued", "empty", "wiped", "shattered", "knackered", "lethargic"],
  9: ["calm", "peaceful", "content", "grounded", "steady", "relaxed", "serene", "chilled", "mellow"],
  10: ["fidgety", "anxious", "wired", "jumpy", "antsy", "nervous", "worried", "uneasy", "scared", "twitchy", "bored"],
  11: ["close", "loved", "warm", "together", "grateful", "appreciated", "supported"],
  12: ["alone", "isolated", "lonesome", "left out", "invisible", "unwanted"],
  13: ["hope", "optimistic", "bright", "upbeat", "positive", "encouraged"],
};

// Beyond English: the closed catalog is what makes multilingual hearing
// safe — a free-text matcher could never be trusted across languages, but
// fourteen words can. Aliases are unaccented; norm() strips diacritics.
const LANG: Record<string, Record<number, string[]>> = {
  es: {
    0: ["ok", "bien", "normal"],
    1: ["tenso", "tensa", "estresado", "estresada", "estres"],
    2: ["mucho", "acelerado", "ocupado"],
    3: ["al limite", "quemado"],
    4: ["abrumado", "agobiado", "superado"],
    5: ["bien", "genial", "feliz", "contento"],
    6: ["triste", "bajo", "mal"],
    7: ["energico", "emocionado"],
    8: ["cansado", "cansada", "agotado", "dormido"],
    9: ["calmado", "tranquilo", "en paz"],
    10: ["ansioso", "ansiosa", "nervioso", "inquieto"],
    11: ["acompanado", "querido", "amado"],
    12: ["solo", "sola", "aislado"],
    13: ["esperanzado", "con esperanza", "ilusionado"],
  },
  fr: {
    0: ["ok", "bien", "normal"],
    1: ["tendu", "tendue", "stresse", "stressee"],
    2: ["deborde", "occupe", "speed"],
    3: ["a bout", "craque"],
    4: ["depasse", "submerge"],
    5: ["bien", "super", "genial", "content"],
    6: ["triste", "bas", "mal"],
    7: ["energique", "excite", "motive"],
    8: ["fatigue", "fatiguee", "epuise"],
    9: ["calme", "detendu", "apaise"],
    10: ["anxieux", "nerveux"],
    11: ["aime", "proche", "entoure"],
    12: ["seul", "seule", "isole"],
    13: ["optimiste", "espoir"],
  },
  de: {
    0: ["okay", "gut", "normal"],
    1: ["gestresst", "angespannt"],
    2: ["viel", "uberlastet"],
    3: ["am ende", "ausgebrannt"],
    4: ["uberwaltigt", "uberfordert"],
    5: ["gut", "super", "toll"],
    6: ["traurig", "schlecht"],
    7: ["motiviert", "energiegeladen"],
    8: ["mude", "erschopft"],
    9: ["ruhig", "gelassen"],
    10: ["nervos", "angstlich", "unruhig"],
    11: ["geliebt", "geborgen", "nah"],
    12: ["allein", "einsam"],
    13: ["hoffnungsvoll", "optimistisch"],
  },
};

const synFor = (i: number): string[] => [
  ...(SYNONYMS[i] ?? []),
  ...Object.values(LANG).flatMap((l) => l[i] ?? []),
];

const norm = (s: string) =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// "not good" is not Light. `norm` destroys the evidence — it turns
// "don't" into "do t" and the word-length gates below drop "not" — so
// negation is checked on the raw transcript first. Any negation returns
// no reading at all and the UI asks instead of declaring: guessing at a
// feeling is the one error this product cannot afford.
const NEGATION =
  /\b(not|no|none|nothing|never|nobody|hardly|barely|without|nor|don'?t|didn'?t|doesn'?t|wasn'?t|isn'?t|aren'?t|weren'?t|can'?t|couldn'?t|shouldn'?t|wouldn'?t|hasn'?t|haven'?t|won'?t|ain'?t)\b/;

export function hasNegation(transcript: string): boolean {
  return NEGATION.test(transcript.toLowerCase());
}

// Rhythm names are a second closed catalog — proposed the same way a
// feeling is (lit, waiting for a tap), never committed by voice. Digits
// live in aliases ("4 7 8"), so this norm keeps them.
const normPattern = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const PATTERN_ALIASES: Record<string, string[]> = {
  box: ["box", "box breathing", "square", "square breathing", "4 4 4 4", "four by four"],
  relaxation: ["4 7 8", "478", "four seven eight", "relaxation", "relaxing breath"],
  wim_hof: ["wim hof", "wimhof", "power breath"],
  sleep: ["sleep", "sleep breath", "sleepy breath", "bedtime", "wind down"],
};

/** transcript → rhythm id, or null. Same rules: closed set, no negation. */
export function matchPattern(transcript: string): string | null {
  if (hasNegation(transcript)) return null;
  const t = normPattern(transcript);
  if (!t) return null;
  for (const [id, aliases] of Object.entries(PATTERN_ALIASES)) {
    if (aliases.some((a) => t === a || t.includes(a))) return id;
  }
  return null;
}

/** transcript → feeling index, or null when nothing matches. */
export function matchFeeling(transcript: string): number | null {
  if (hasNegation(transcript)) return null;
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
    for (const w of synFor(i)) if (t.includes(w)) score += 2;
    if (score > 0 && (best === null || score > best.score)) best = { index: i, score };
  }
  return best?.index ?? null;
}

const POS_WORDS = ["love", "amazing", "wonderful", "fantastic", "awesome", "yay", "brilliant", "lovely"];
const NEG_WORDS = ["hate", "awful", "terrible", "horrible", "meh", "ugh", "rough", "sucks", "worst", "blah"];

/** Softer second tier for near-misses: prefix overlap or valence. */
export function suggestFeeling(transcript: string): number | null {
  if (hasNegation(transcript)) return null;
  const t = norm(transcript);
  if (!t) return null;
  const words = t.split(" ").filter((w) => w.length >= 4);
  let best: { index: number; hits: number } | null = null;
  for (let i = 0; i < FEELINGS.length; i++) {
    const cands = [
      norm(FEELINGS[i].label),
      norm(FEELINGS[i].longLabel),
      ...synFor(i),
    ];
    let hits = 0;
    for (const w of words)
      for (const c of cands)
        if (w.startsWith(c.slice(0, 4)) || c.startsWith(w.slice(0, 4))) hits++;
    if (hits > 0 && (best === null || hits > best.hits)) best = { index: i, hits };
  }
  if (best) return best.index;
  if (POS_WORDS.some((p) => t.includes(p))) return 5;
  if (NEG_WORDS.some((p) => t.includes(p))) return 6;
  return null;
}

export function voiceCheckinSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  // Streaming needs only getUserMedia + WebSocket (covers iOS Safari,
  // which lacks MediaRecorder); file path adds MediaRecorder; Web
  // Speech is the last resort.
  return !!(
    (typeof navigator.mediaDevices?.getUserMedia === "function" &&
      (w.MediaRecorder || w.WebSocket)) ||
    w.SpeechRecognition || w.webkitSpeechRecognition
  );
}

export interface HeardResult {
  transcript: string;
  index: number | null;
  /** A near-match worth offering when index is null — never blocks. */
  suggest: number | null;
  /** A rhythm name heard only when no feeling was offered — one
   *  proposal at a time, and feelings always win the question. */
  pattern: string | null;
}

const TOKEN_ENDPOINT = STT_ENDPOINT + "-token";
const WS_URL = "wss://streaming.assemblyai.com/v3/ws";
const SILENCE_MS = 800;
const MAX_LISTEN_MS = 6000;

// Live path: stream PCM16 to AssemblyAI's realtime WS — transcripts
// arrive as we speak. Falls back to the file path on any failure.
async function viaStreaming(onInterim?: (s: string) => void, signal?: AbortSignal): Promise<string> {
  const tok = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: voiceHeaders() });
  if (!tok.ok) throw new Error("no_token");
  const { token } = (await tok.json()) as { token: string };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ws = new WebSocket(`${WS_URL}?token=${token}&sample_rate=16000&format_turns=true&language_detection=true`);
  // Turns are the transcript's phrases — "I'm tense — big call" arrives as
  // several, and keeping only the last one drops the feeling word. Join
  // them; the match layer sees the whole sentence.
  const turns: string[] = [];
  const final = () => turns.join(" ");
  let silenceSince = 0;
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  src.connect(proc);
  proc.connect(ctx.destination);
  const heard = new Promise<string>((resolve, reject) => {
    const stop = (v: string) => {
      try { ws.close(); } catch { void 0; }
      resolve(v);
    };
    ws.onerror = () => reject(new Error("ws_error"));
    signal?.addEventListener("abort", () => stop(final()));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "Turn" && m.transcript) {
        turns.push(m.transcript);
        silenceSince = Date.now();
        if (!m.end_of_turn) onInterim?.(final());
        else stop(final());
      } else if (m.type === "Termination") stop(final());
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
      if (turns.length && peak < 0.02 && Date.now() - silenceSince > SILENCE_MS) stop(final());
      else ws.send(pcm.buffer);
    };
    setTimeout(() => stop(final()), MAX_LISTEN_MS);
  });
  try {
    return await heard;
  } finally {
    proc.disconnect(); src.disconnect(); ctx.close();
    stream.getTracks().forEach((t) => t.stop());
  }
}

async function viaAssemblyAI(onInterim?: (s: string) => void, signal?: AbortSignal): Promise<string> {
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
        if (signal?.aborted || (spoke && quietMs > SILENCE_MS) || (!spoke && quietMs > 2500)) {
          clearInterval(iv); resolve();
        }
      }, 100);
      setTimeout(() => { clearInterval(iv); resolve(); }, LISTEN_MS);
    });
    rec.stop();
    ctx.close();
    await stopped;
    if (spoke) onInterim?.("hearing…");
    const res = await fetch(STT_ENDPOINT, {
      method: "POST",
      headers: voiceHeaders({ "Content-Type": "application/octet-stream" }),
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
    rec.lang = navigator.language || "en-US";
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
  signal?: AbortSignal,
): Promise<HeardResult> {
  let transcript: string;
  try {
    transcript = await viaStreaming(onInterim, signal);
  } catch {
    try {
      transcript = await viaAssemblyAI(onInterim, signal);
    } catch {
      transcript = await viaWebSpeech(onInterim).catch(() => "");
    }
  }
  const index = matchFeeling(transcript);
  const suggest = index == null ? suggestFeeling(transcript) : null;
  return {
    transcript,
    index,
    suggest,
    pattern: index == null && suggest == null ? matchPattern(transcript) : null,
  };
}
