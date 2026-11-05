# API Documentation

> **Status: historical.** This describes the vision service as it existed for
> the chain-era product — frame analysis, AI insights, attestations, Lens
> signing, RevenueCat. The web app no longer calls any vision/AI endpoint.
> What production actually uses on this service (`api.brume.trustfall.xyz`)
> today is the voice surface only: `/api/tts` (spoken lines) and the
> check-in transcription route behind `src/lib/voiceCheckin.ts`, both
> metered by `voice_guard.py`. See AGENTS.md "The voice server" for the
> current contract.

API reference for the Brume vision service (FastAPI, `backend/vision-service`).
This is the service the frontend calls for frame analysis, AI insights, and
proof-of-practice attestations.

## Overview

The service provides:

- **Vision processing** — MediaPipe-based frame analysis (face, posture,
  breathing) with per-session state
- **AI analysis** — session insights via Cerebras / Gemini / OpenAI fallback
- **Attestations** — server-verified proof-of-practice issuance with a
  Flow-compatible verifier co-signature
- **Lens session signing** — quiet infrastructure for verifiable session records
- **RevenueCat config** — monetization configuration for the client

## Authentication

The vision service endpoints do **not** use Supabase JWTs. Session privacy is
capability-based: the `session_id` is a UUID generated client-side at session
start, and session data is keyed only by it. The attest endpoint additionally
requires that the session accumulated real camera data server-side before it
will issue anything (see below). Supabase auth secures app data (profiles,
progress, subscriptions) on the frontend, not these endpoints.

## Endpoints

### Vision

#### POST /api/vision/process

Analyze a single camera frame within a session.

**Request Body:**
```json
{
  "image_data": "<base64 image>",
  "session_id": "uuid",
  "timestamp": 1724800000000,
  "breathing_phase": "inhale",
  "options": { "detect_face": true, "analyze_posture": true, "track_breathing": true }
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid",
  "metrics": {
    "confidence": 0.97,
    "face_detected": true,
    "posture_score": 82.5,
    "movement_level": 0.12,
    "breathing_rate": 5.4,
    "landmarks": [],
    "processing_time_ms": 18.2
  }
}
```

#### GET /api/vision/sessions/{session_id}/summary

Aggregated session metrics (duration, total frames, avg confidence/posture/
movement/breathing rate, stillness percentage, consistency score).

#### GET /api/vision/sessions

List active sessions (debug/ops).

#### POST /api/vision/session/{session_id}/stop

Stop a session (finalizes state).

#### DELETE /api/vision/session/{session_id}

Discard a session's server-side state (privacy — nothing persists after this).

### AI Analysis

#### POST /api/ai-analysis

Generate session insights.

**Request Body:**
```json
{
  "provider": "cerebras",
  "session_data": { "patternName": "Box Breathing", "sessionDuration": 120 },
  "analysis_type": "session"
}
```

**Response:**
```json
{
  "success": true,
  "provider": "cerebras",
  "analysis_type": "session",
  "result": { "analysis": "…" },
  "cached": false
}
```

#### POST /api/ai-analysis/stream

Streaming variant (server-sent events).

### Attestations (trust layer)

#### POST /api/attest

Issue a ProofOfPractice attestation for a camera-verified session.

**Security model** (see `docs/PR9_REVIEW_NOTES.md` resolution addendum):

- There is **no `verified` field** — verification is established server-side:
  the session must exist in the vision processor's store with ≥10 real
  breathing/confidence frames. A bare curl cannot mint an attestation.
- `session_score` is **ignored** — the score is computed server-side from the
  session's own breathing data (consistency of measured rate).
- `wallet_address` must be the **Flow address that will submit the on-chain
  transaction** — it is bound into the co-signature payload.

**Request Body:**
```json
{
  "session_id": "uuid",
  "wallet_address": "0x1234…",
  "breath_rate": null,
  "duration_seconds": 120
}
```

**Response:**
```json
{
  "success": true,
  "credential": {
    "sessionId": "uuid",
    "subject": "0x0000000000001234",
    "issuedAt": "2026-08-28T06:00:00+00:00",
    "metrics": { "breath_rate": 5.4, "session_score": 87.5, "duration_seconds": 120 }
  },
  "attestation": { "status": "pending_chain", "txId": null, "network": "flow-testnet" },
  "verifier_signature": {
    "verifier_address": "0x…",
    "verifier_signature_hex": "…",
    "signed_data_hex": "…"
  }
}
```

The client passes `verifier_signature` to the user-initiated Flow transaction
(`cadence/transactions/attest_practice.cdc`). The `PracticeCredential` contract
accepts the credential only if the verifier is allowlisted, the signed payload
equals `sessionId || subject.toString() || score.toString()`, and the signature
verifies against the verifier account's key (ECDSA/secp256k1 over
`SHA3-256(pad32(tag) || payload)`, tag `Brume-PracticeCredential-v1`).
Verifier setup: `docs/RUNBOOK.md` §8.

#### GET /api/session/{session_id}/verify-status

Whether a session has enough camera data to be considered verified (used by
the MCP server and clients; never trusts a client flag).

**Response:**
```json
{
  "session_id": "uuid",
  "verified": true,
  "breathing_frames": 42,
  "confidence_frames": 40,
  "breath_rate": 5.4
}
```

### Lens (quiet infrastructure)

#### POST /lens/sign-session

Sign a breathing session record (Lens V3 Open Action proof). No social
surfaces remain in the app — this endpoint is plumbing, not a feature.

**Request Body:**
```json
{
  "user_address": "0x…",
  "pattern_name": "Box Breathing",
  "duration": 120,
  "score": 87,
  "timestamp": "2026-08-28T06:00:00Z"
}
```

**Response:** `{ "payload": { … }, "signature": "0x…" }`

### Monetization

#### GET /revenuecat

RevenueCat configuration for the client (public SDK keys, entitlement ids).

#### GET /revenuecat/status

Configuration health check.

### Ops

#### GET /health

Service status (includes Cerebras backend status).

## Error Handling

Errors use FastAPI's standard shape:

```json
{ "detail": "Cannot attest unverified practice: session … has only 3 breathing frames …" }
```

Attest-specific rejections return `400` with a human-readable `detail`
(session missing, insufficient frames, malformed Flow address).

## Rate Limiting

Not yet enforced on the vision service — tracked in
`docs/PRODUCTION_READINESS.md` (Priority 2).

## Security

- All endpoints served over HTTPS in production
- CORS restricted to app origins
- No raw video is stored: frames are processed in-memory and discarded
- Attestations cannot be forged or replayed (contract-enforced payload
  binding + authorized-verifier co-signature)
