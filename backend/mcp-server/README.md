# @brume/mcp-server

Proof-of-Practice primitives for agents. The agent-native wedge (see `docs/STRATEGY.md` §4).

Agents that coach humans cannot verify physical practice. Brume can. This server
exposes that capability as four MCP tools any agent can call — metered per key
today, x402-style per-call payments next.

## Tools

| Tool | What it does | Backend |
|---|---|---|
| `breath_verify_session` | Verify a session from camera-derived signal samples → `verified`, breath rate, depth, score | `POST /api/vision/process` ✅ live |
| `breath_recommend_pattern` | Detected/self-reported state → pattern recommendation | Local heuristic table ✅ |
| `breath_attest_practice` | Issue portable on-chain proof-of-practice credential | ⚠️ needs `POST /api/attest` in vision-service |
| `coach_respond` | Zen coaching grounded in measured breath data | `POST /api/ai-analysis` ✅ live |

## Run

```bash
npm install && npm run build
BRUME_API_KEYS=key1,key2 BRUME_VISION_URL=https://api.brume.trustfall.xyz npm start
```

## Privacy invariant

Raw video never leaves the client device. Tools receive only derived metrics
(signal samples, rates, scores). This is non-negotiable — it's in the app's
public privacy promise and is a selling point to agent builders.

## Roadmap

1. **Now:** metered API keys (`BRUME_API_KEYS`)
2. **Next:** `POST /api/attest` route in `backend/vision-service` (Flow attestation)
3. **Then:** x402 per-call payments (TODO markers in `src/index.ts`), usage
   dashboard — the agent-revenue evidence trail for the HAMM award
