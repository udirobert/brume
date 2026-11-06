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

/** Why a listen produced nothing — said out loud, not shrugged off. */
export type VoiceFailure = "mic_blocked" | "no_mic" | "offline" | "unavailable" | "insecure";

export interface HeardResult {
  transcript: string;
  index: number | null;
  /** A near-match worth offering when index is null — never blocks. */
  suggest: number | null;
  /** A rhythm name heard only when no feeling was offered — one
   *  proposal at a time, and feelings always win the question. */
  pattern: string | null;
  /** Set when listening itself failed (as opposed to hearing nothing). */
  failure: VoiceFailure | null;
}

/**
 * Whether the person is still holding the button. Read live, so one press
 * can begin as a hold and be settled into a tap a moment later: a press
 * shorter than the threshold turns the hold off and the usual silence rules
 * take over; a longer one stays on until release.
 */
export interface ListenControl {
  hold: boolean;
}

// ---- Voice input mode --------------------------------------------------------
// Hold is the default: the mic is open exactly while the finger is down, so
// a pause mid-sentence can never cut you off and the end is always yours.
// Tap is the opt-in (kept for people who can't sustain a press): one press
// starts hands-free, silence or a second press ends it. One sentence either
// way — the mode changes who decides when it is over, nothing else.

export type MicMode = "hold" | "tap";
const MIC_MODE_KEY = "brume.micMode.v1";

export function getMicMode(): MicMode {
  try {
    return window.localStorage.getItem(MIC_MODE_KEY) === "tap" ? "tap" : "hold";
  } catch {
    return "hold";
  }
}

export function setMicMode(mode: MicMode): void {
  try {
    window.localStorage.setItem(MIC_MODE_KEY, mode);
  } catch {
    // Storage refused — the preference stays hold for this visit.
  }
}

const TOKEN_ENDPOINT = STT_ENDPOINT + "-token";
const WS_URL = "wss://streaming.assemblyai.com/v3/ws";
const TARGET_RATE = 16000;
const SILENCE_MS = 800;
const MAX_LISTEN_MS = 6000;
/** Held down, there is no silence rule — but a hot mic still has a ceiling. */
const HOLD_MAX_MS = 20000;
/** After release, how long to wait for the last words to be transcribed. */
const RELEASE_GRACE_MS = 1500;
/** Audio spoken before the socket opens is kept, not dropped (~8 s at 16 kHz). */
const PENDING_MAX_BYTES = 16000 * 2 * 8;
const SPEECH_PEAK = 0.02;

// ---- pure helpers (tested) -------------------------------------------------

/**
 * Float samples at the context's own rate → PCM16 at 16 kHz, plus the peak.
 * Phones run their audio context at 48 kHz, desktops at 44.1 — the rate is
 * read, never assumed, and each output sample averages the input it spans
 * (a box filter) rather than skipping samples, which aliases speech.
 */
export function toPcm16(input: Float32Array, inRate: number): { pcm: Int16Array; peak: number } {
  const ratio = inRate > TARGET_RATE ? inRate / TARGET_RATE : 1;
  const n = Math.floor(input.length / ratio);
  const pcm = new Int16Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.max(from + 1, Math.min(input.length, Math.floor((i + 1) * ratio)));
    let sum = 0;
    for (let j = from; j < to; j++) sum += input[j];
    const v = Math.max(-1, Math.min(1, sum / (to - from)));
    peak = Math.max(peak, Math.abs(v));
    pcm[i] = Math.round(v * 32767);
  }
  return { pcm, peak };
}

interface TurnMessage {
  transcript?: string;
  end_of_turn?: boolean;
  turn_is_formatted?: boolean;
}

/**
 * Joins what the recognizer sends into one sentence. A Turn message carries
 * the whole turn so far, not a delta, so only the latest of an unfinished
 * turn counts; a finished turn is kept, and the formatted repeat of a
 * finished turn replaces its raw twin instead of doubling it. The pause
 * that splits "I'm tense — big call" into two turns must not lose either.
 */
export function createTurnJoiner() {
  const done: string[] = [];
  let live = "";
  let lastEndWasRaw = false;
  return {
    add(m: TurnMessage): void {
      const t = (m.transcript ?? "").trim();
      if (!t) return;
      if (m.end_of_turn) {
        if (lastEndWasRaw && m.turn_is_formatted) done[done.length - 1] = t;
        else done.push(t);
        lastEndWasRaw = !m.turn_is_formatted;
        live = "";
      } else {
        live = t;
        lastEndWasRaw = false;
      }
    },
    text(): string {
      return [...done, live].filter(Boolean).join(" ");
    },
    hasText(): boolean {
      return done.length > 0 || live !== "";
    },
  };
}

/** getUserMedia refusals, told apart: blocked by the person, or no mic to use. */
export function classifyMicError(err: unknown): VoiceFailure {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "mic_blocked";
  }
  return "no_mic";
}

// ---- Recovery help -----------------------------------------------------------
// The pill line names the failure; the help card says what to actually do.
// Closed table (like spokenGreeting): everything a stuck person can read is
// ours, literal in source, and checked by copy-claims.test.ts.

/** Browsers embedded inside other apps withhold the microphone entirely. */
const IN_APP_RE =
  /instagram|fban|fbav|fb_iab|linkedin|twitter|tiktok|snapchat|micromessenger|\bline\/|kakaotalk|pinterest|discord|telegram|wechat/i;

export type DeviceKind = "inapp" | "ios" | "android" | "other";

export function deviceKindFromUA(ua: string): DeviceKind {
  if (IN_APP_RE.test(ua)) return "inapp";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

/** The exit is always part of the help — the chips work without the mic. */
export const VOICE_HELP_EXIT = "Or just tap a word.";

export const VOICE_HELP: Record<VoiceFailure, Record<DeviceKind, string> | string> = {
  mic_blocked: {
    inapp:
      "This page is open inside another app’s browser, and those don’t share the microphone. Open it in Safari or Chrome, then try again.",
    ios:
      "The microphone is switched off for this site. Tap aA in the address bar, choose Website Settings, and turn Microphone on.",
    android:
      "The microphone is switched off for this site. Tap the lock in the address bar, choose Permissions, and allow the microphone.",
    other:
      "The microphone is switched off for this site. Allow it in your browser’s site settings, then try again.",
  },
  no_mic: "There’s no microphone this page can reach. The words below still work.",
  offline:
    "There’s no connection right now, and the voice needs one. It usually comes back on its own.",
  unavailable:
    "The voice isn’t available just now. The words below still work.",
  insecure:
    "The microphone only works over a private (https) connection. Open the usual address, or use the words below.",
};

/** Full card text for a failure on this device — step plus the way out. */
export function voiceHelpFor(failure: VoiceFailure, ua: string): string {
  const entry = VOICE_HELP[failure];
  const step = typeof entry === "string" ? entry : entry[deviceKindFromUA(ua)];
  return `${step} ${VOICE_HELP_EXIT}`;
}

/** What the screen says for each failure — short, and always with a way out. */
export const VOICE_FAILURE_COPY: Record<VoiceFailure, string> = {
  // A refusal with no prompt means the site was denied before (iOS keeps
  // that memory) or the browser itself withholds the mic — say the fix.
  mic_blocked: "mic is off for this site — allow it in your browser’s site settings, or tap a word",
  no_mic: "can’t reach the microphone — tap a word",
  offline: "no connection — tap a word",
  unavailable: "voice isn’t available just now — tap a word",
  insecure: "the mic needs a private connection — tap a word",
};

// The stage that failed and the error's class — never audio, never words.
function trace(stage: string, err: unknown): void {
  const e = err as { name?: string; message?: string } | null;
  const what = e?.name && e.name !== "Error" ? e.name : (e?.message ?? "error");
  console.warn(`[voice] ${stage} failed: ${what}`);
}

const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

// ---- the three ways to hear -------------------------------------------------

// Live path: stream PCM16 to AssemblyAI's realtime WS — transcripts
// arrive as we speak. Throws on any failure so the next path can try.
async function viaStreaming(
  stream: MediaStream,
  ctx: AudioContext,
  ctl: ListenControl,
  onInterim?: (s: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const tok = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: voiceHeaders() });
  if (!tok.ok) throw new Error(`token_${tok.status}`);
  const { token } = (await tok.json()) as { token?: string };
  if (!token) throw new Error("token_empty");

  const joiner = createTurnJoiner();
  // The microphone starts feeding the moment the token is in hand, and the
  // socket takes a beat to open — what is said in that beat is kept and sent
  // on open, so the first word of a held press is not the one that is lost.
  const pending: ArrayBuffer[] = [];
  let pendingBytes = 0;

  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const sink = ctx.createGain();
  sink.gain.value = 0; // the processor runs; the mic is never played back
  src.connect(proc);
  proc.connect(sink);
  sink.connect(ctx.destination);

  const ws = new WebSocket(`${WS_URL}?token=${token}&sample_rate=${TARGET_RATE}&format_turns=true&language_detection=true&speech_model=universal-3-6-pro&language_codes=["en","es","fr","de"]&keyterms_prompt=["Tense","Overwhelmed","Drained","Settled","Light","box breathing","4-7-8"]&min_end_of_turn_silence_when_confident=600&max_turn_silence=1400`);
  const t0 = Date.now();
  let silenceSince = t0;
  let opened = false;
  let releasing = false;
  let spoke = false;

  try {
    return await new Promise<string>((resolve, reject) => {
      let settled = false;
      let grace: ReturnType<typeof setTimeout> | undefined;
      const cap = setInterval(() => {
        if (Date.now() - t0 > (ctl.hold ? HOLD_MAX_MS : MAX_LISTEN_MS)) release();
      }, 250);
      const close = () => {
        settled = true;
        clearTimeout(grace);
        clearInterval(cap);
        try { ws.close(); } catch { void 0; }
      };
      const stop = () => {
        if (settled) return;
        close();
        resolve(joiner.text());
      };
      const fail = (e: Error) => {
        if (settled) return;
        close();
        reject(e);
      };
      const forceEndpoint = () => {
        try { ws.send(JSON.stringify({ type: "ForceEndpoint" })); } catch { void 0; }
      };
      // Letting go: ask for the turn to end now so the last word arrives,
      // then wait briefly for it. Nothing said means nothing to wait for.
      const release = () => {
        if (releasing || settled) return;
        releasing = true;
        if (!spoke && !joiner.hasText()) return stop();
        if (ws.readyState === WebSocket.OPEN) forceEndpoint();
        grace = setTimeout(stop, RELEASE_GRACE_MS);
      };

      ws.onopen = () => {
        opened = true;
        for (const chunk of pending) ws.send(chunk);
        pending.length = 0;
        pendingBytes = 0;
        // Released while we were still connecting: the words sat in the
        // buffer — send them, then ask for the turn to end.
        if (releasing) {
          forceEndpoint();
          grace = setTimeout(stop, RELEASE_GRACE_MS);
        }
      };
      ws.onerror = () => fail(new Error("ws_error"));
      ws.onclose = () => (opened ? stop() : fail(new Error("ws_closed")));
      ws.onmessage = (e) => {
        let m: { type?: string } & TurnMessage;
        try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === "Turn" && m.transcript) {
          joiner.add(m);
          silenceSince = Date.now();
          onInterim?.(joiner.text());
          // Held, a finished turn is only a pause; released or tapped, it is the end.
          if (m.end_of_turn && (releasing || !ctl.hold)) stop();
        } else if (m.type === "Termination") stop();
      };

      proc.onaudioprocess = (ev) => {
        if (settled) return;
        const { pcm, peak } = toPcm16(ev.inputBuffer.getChannelData(0), ctx.sampleRate);
        if (peak > SPEECH_PEAK) spoke = true;
        if (!ctl.hold && !releasing && joiner.hasText() && peak < SPEECH_PEAK && Date.now() - silenceSince > SILENCE_MS) {
          return stop();
        }
        if (opened && ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer as ArrayBuffer);
        else if (!opened && pendingBytes < PENDING_MAX_BYTES) {
          pending.push(pcm.buffer as ArrayBuffer);
          pendingBytes += pcm.byteLength;
        }
      };

      // If the finger came up while the socket is still connecting, do not
      // give up on the utterance — keep buffering until it opens.
      const onAbort = () => (opened ? release() : (releasing = true));
      if (signal?.aborted) onAbort();
      else signal?.addEventListener("abort", onAbort);
    });
  } finally {
    proc.onaudioprocess = null;
    proc.disconnect();
    src.disconnect();
    sink.disconnect();
  }
}

// Fallback: record a clip, POST it, read the words back. Held, it records
// until release; tapped, it stops on a quiet stretch after speech.
async function viaAssemblyAI(
  stream: MediaStream,
  ctx: AudioContext,
  ctl: ListenControl,
  onInterim?: (s: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const mime = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const parts: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  onInterim?.("listening…");

  const an = ctx.createAnalyser();
  an.fftSize = 512;
  const node = ctx.createMediaStreamSource(stream);
  node.connect(an);
  const buf = new Uint8Array(an.frequencyBinCount);
  let spoke = false;
  let quietMs = 0;
  let elapsed = 0;
  await new Promise<void>((resolve) => {
    const iv = setInterval(() => {
      elapsed += 100;
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const b of buf) peak = Math.max(peak, Math.abs(b - 128) / 128);
      if (peak > SPEECH_PEAK) { spoke = true; quietMs = 0; } else quietMs += 100;
      const quietStop = !ctl.hold && ((spoke && quietMs > SILENCE_MS) || (!spoke && quietMs > 2500));
      const capped = elapsed >= (ctl.hold ? HOLD_MAX_MS : LISTEN_MS);
      if (signal?.aborted || quietStop || capped) {
        clearInterval(iv);
        resolve();
      }
    }, 100);
  });
  node.disconnect();
  if (rec.state !== "inactive") rec.stop();
  await stopped;
  if (spoke) onInterim?.("hearing…");
  const res = await fetch(STT_ENDPOINT, {
    method: "POST",
    headers: voiceHeaders({ "Content-Type": "application/octet-stream" }),
    body: new Blob(parts, { type: rec.mimeType || "audio/webm" }),
  });
  if (!res.ok) throw new Error(`stt_${res.status}`);
  const { text } = (await res.json()) as { text: string };
  return text ?? "";
}

// Last resort: the browser's own recognition. "Heard nothing" is a miss and
// resolves; only a refusal or a real fault rejects.
function viaWebSpeech(
  ctl: ListenControl,
  onInterim?: (s: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  interface SpeechRecognitionLike {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    maxAlternatives: number;
    onresult: ((e: SpeechLikeEvent) => void) | null;
    onerror: ((e: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }
  interface SpeechLikeEvent {
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
  }
  return new Promise((resolve, reject) => {
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
      | (new () => SpeechRecognitionLike)
      | undefined;
    if (!Ctor) return reject(new Error("no_speech_api"));
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = ctl.hold;
    rec.maxAlternatives = 1;
    const finals: string[] = [];
    rec.onresult = (e: SpeechLikeEvent) => {
      const last = e.results[e.results.length - 1];
      const t = last[0].transcript;
      if (last.isFinal) finals.push(t);
      else onInterim?.(t);
    };
    rec.onerror = (e: { error?: string }) => {
      const code = String(e?.error ?? "");
      if (code === "no-speech" || code === "aborted") return resolve(finals.join(" "));
      reject(new Error(code || "speech_error"));
    };
    rec.onend = () => resolve(finals.join(" "));
    const stop = () => { try { rec.stop(); } catch { void 0; } };
    if (signal?.aborted) return resolve("");
    signal?.addEventListener("abort", stop);
    onInterim?.("listening…");
    rec.start();
  });
}

/**
 * One shot: listen → transcribe → match. Returns the heard words too.
 *
 * Everything that needs the user's gesture — the audio context, the
 * microphone request — happens before the first await, because iOS treats
 * a context made later as not made by the person and leaves it asleep.
 */
export async function listenOnce(
  onInterim?: (s: string) => void,
  signal?: AbortSignal,
  ctl: ListenControl = { hold: false },
): Promise<HeardResult> {
  const result = (transcript: string, failure: VoiceFailure | null): HeardResult => {
    const index = matchFeeling(transcript);
    const suggest = index == null ? suggestFeeling(transcript) : null;
    return {
      transcript,
      index,
      suggest,
      pattern: index == null && suggest == null ? matchPattern(transcript) : null,
      failure,
    };
  };

  // Browsers refuse the microphone outright off HTTPS — name that instead
  // of failing deeper down where the reason is no longer visible.
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return result("", "insecure");
  }

  let ctx: AudioContext | null = null;
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    ctx = AC ? new AC() : null;
    void ctx?.resume().catch(() => {});
  } catch (err) {
    trace("audio", err);
    ctx = null;
  }
  const micRequest: Promise<MediaStream> | null =
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
      ? navigator.mediaDevices.getUserMedia({ audio: true })
      : null;

  let stream: MediaStream | null = null;
  const release = () => {
    stream?.getTracks().forEach((t) => t.stop());
    void ctx?.close().catch(() => {});
  };

  try {
    if (micRequest) {
      try {
        stream = await micRequest;
      } catch (err) {
        trace("mic", err);
        return result("", classifyMicError(err));
      }
    }
    if (stream && ctx) {
      try { await ctx.resume(); } catch (err) { trace("resume", err); }
      try {
        return result(await viaStreaming(stream, ctx, ctl, onInterim, signal), null);
      } catch (err) {
        trace("stream", err);
      }
      // Let go before the fallbacks if the person already has: a clip
      // recorded from here would be silence they never spoke.
      if (signal?.aborted) return result("", offline() ? "offline" : "unavailable");
      try {
        return result(await viaAssemblyAI(stream, ctx, ctl, onInterim, signal), null);
      } catch (err) {
        trace("clip", err);
      }
      if (signal?.aborted) return result("", offline() ? "offline" : "unavailable");
    }
    // The browser's recognizer opens the mic itself; hold ours back so the
    // two don't fight over it.
    stream?.getTracks().forEach((t) => t.stop());
    try {
      return result(await viaWebSpeech(ctl, onInterim, signal), null);
    } catch (err) {
      trace("speech", err);
      const code = (err as Error)?.message ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") return result("", "mic_blocked");
      return result("", offline() ? "offline" : "unavailable");
    }
  } finally {
    release();
  }
}
