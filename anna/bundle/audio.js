// Sound guidance for Brume sessions: WebAudio chimes or host TTS voice.
// Everything degrades silently — a session with no sound still works.
//
// Chime: synthesized soft tones, distinct for in-breaths (inhale/topup)
// vs exhale; holds stay quiet. The AudioContext is created/resumed
// inside the Begin click handler (user-gesture requirement).
//
// Voice: anna.audio.speak with inline (base64) delivery, decoded via
// AudioContext.decodeAudioData — no <audio> element, no presigned URLs,
// no CSP media-src dependence. Buffers are cached in memory for the
// lifetime of the window only, per docs ("never persist URLs").
// Voices come from llm.catalog({serviceType:"tts"}) — the user's
// preferred model's defaultVoice — never hard-coded.

export class ChimePlayer {
  constructor() {
    this.ctx = null;
  }

  // Called from the Begin click (gesture) to satisfy autoplay policy.
  ensureContext() {
    if (typeof AudioContext !== "function") return null;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  // A soft, short sine tone with an exponential fade — nothing jarring.
  play(phase) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    let freq = 0;
    if (phase === "inhale") freq = 392; // G4
    else if (phase === "topup") freq = 494; // B4 — a little higher
    else if (phase === "exhale") freq = 262; // C4
    else return; // holds and rests stay quiet
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.0);
  }
}

// Raised when speak/catalog fails so the caller can fall back to chime.
export class VoiceUnavailable extends Error {}

export class VoiceGuide {
  constructor(anna, chimeCtx) {
    this.anna = anna;
    this.chimeCtx = chimeCtx; // shared AudioContext for decode + playback
    this.voice = null;
    this.buffers = new Map(); // text -> Promise<AudioBuffer>
    this.failed = false;
  }

  // Resolve the user's preferred TTS model + its defaultVoice. Throws
  // VoiceUnavailable when audio isn't usable for this app.
  async init() {
    try {
      const cat = await this.anna.llm.catalog({ serviceType: "tts" });
      const models = (cat && cat.models) || [];
      if (!models.length) throw new VoiceUnavailable("no tts models granted");
      const model = models.find((m) => m.isUserPreferred) || models[0];
      this.voice = model?.capabilities?.defaultVoice || null;
      if (!this.voice) throw new VoiceUnavailable("model has no defaultVoice");
      this.modelName = model.modelName;
    } catch (e) {
      this.failed = true;
      if (e instanceof VoiceUnavailable) throw e;
      const v = new VoiceUnavailable(e?.message || "catalog failed");
      v.code = e?.code;
      throw v;
    }
  }

  _decode(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  // Fetch (or return the in-flight fetch of) a spoken buffer for text.
  speakBuffer(text) {
    if (this.failed) return Promise.reject(new VoiceUnavailable("voice off"));
    if (this.buffers.has(text)) return this.buffers.get(text);
    const p = (async () => {
      const res = await this.anna.audio.speak({
        text,
        voice: this.voice,
        model: this.modelName,
        format: "mp3",
        delivery: "inline",
      });
      const b64 = res?.audioBase64;
      if (!b64) throw new VoiceUnavailable("no inline audio returned");
      const ctx = this.chimeCtx.ensureContext();
      if (!ctx) throw new VoiceUnavailable("no audio context");
      return await ctx.decodeAudioData(this._decode(b64));
    })();
    // Cache the promise; on failure mark voice dead and drop the entry.
    this.buffers.set(text, p);
    p.catch((e) => {
      this.failed = true;
      this.buffers.delete(text);
      throw e;
    });
    return p;
  }

  // Fire-and-forget playback of a previously buffered utterance.
  play(text) {
    const ctx = this.chimeCtx.ensureContext();
    const p = this.buffers.get(text);
    if (!ctx || !p) return;
    Promise.resolve(p)
      .then((buf) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start();
      })
      .catch(() => {});
  }
}
