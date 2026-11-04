// POST /api/tts — speaks one short line through AssemblyAI's TTS.
//
// The key stays server-side (ASSEMBLYAI_API_KEY env var). The browser
// sends { text } and gets audio/wav back; anything else gets a 4xx.
// We never log the text — only its length and the upstream status.
// One sentence is the whole use case, so the input is capped hard.

const MAX_CHARS = 280;
const UPSTREAM = "https://tts.us.assemblyai.com/v1/speech";
const TIMEOUT_MS = 12_000;

const json = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return json(503, { error: "voice_unavailable" });

  let text;
  try {
    text = JSON.parse(event.body || "{}").text;
  } catch {
    return json(400, { error: "bad_json" });
  }
  if (typeof text !== "string" || !text.trim() || text.length > MAX_CHARS) {
    return json(400, { error: "bad_text" });
  }

  const body = { text: text.trim(), container: "wav", stream: false };
  if (process.env.ASSEMBLYAI_VOICE_ID) body.voice_id = process.env.ASSEMBLYAI_VOICE_ID;

  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    console.warn(`tts upstream failed (chars=${text.length})`);
    return json(502, { error: "upstream_unreachable" });
  }

  if (!upstream.ok) {
    console.warn(`tts upstream ${upstream.status} (chars=${text.length})`);
    return json(502, { error: "upstream_error" });
  }

  const audio = Buffer.from(await upstream.arrayBuffer());
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "private, max-age=86400",
    },
    body: audio.toString("base64"),
    isBase64Encoded: true,
  };
};
