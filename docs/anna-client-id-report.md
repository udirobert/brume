# Chat executa invocations fail on `client_id` — a *valid* online client ID is still rejected

**Category:** Developers · executa
**Affected surface:** main chat (copilot) sessions → installed Executa tools

## Summary

Every call to an installed Executa tool from a main chat thread fails at dispatch with `client_id is required`. The error text suggests two escapes — omit it so the host injects, or pass "a real online Matrix Agent ID". **Neither works**: omitting never gets an injection, and passing the session's own online agent ID (verified present in the error's own `online_clients` list) is rejected identically. There is no user-side route around it — this blocks any app whose reviewer is asked to invoke a bundled tool from chat.

## Repro (fresh state)

- Account: papaandthejimjams@gmail.com — exactly **one** agent registered: Cloud Agent `e82dd025c1d368-3ddd21fe`, **set as default and Online** ("Your default Agent is online; Ask / auto mode will use it"). Client ID `agent_dcc86f05e19c45b3a4f9e9aa3ddd21fe`, agent `v1.1.0-beta.54`, Executas 4/4 Running.
- Tool: `tool-papa-brume-htcxvfcr` — deployed both via the app install ("Deploying bundled tools…" completed) and an explicit Executa Hub → My Tools → Install on the cloud agent.
- Model: BYOK `byok:sandbase/anthropic/claude-haiku-5.5` as Main Model.

## Evidence

1. `#brume quick reset` → model calls `brume_reset` with no `client_id` →
   `{"success": false, "error": "client_id is required and must be a real online Matrix Agent ID. … or simply omit the client_id argument so the host injects it automatically.", "online_clients": [40+ agent_* ids]}`
2. Ship a tool version that declares optional `client_id` → model calls it with **`client_id: "agent_dcc86f05e19c45b3a4f9e9aa3ddd21fe"`** — the real, online, default agent, **present verbatim in `online_clients`** → **identical error**.
3. `get_default_client` (the error's own suggested discovery path) → `user_id is required` — the same class of missing context injection one level down.
4. Fails identically on `brume_reset` (pure RPC) and `brume_prepare` (returns `open_window`) — not specific to window results.

## Ruled out

- Deploy target — identical failure after synchronous Executa Hub install on the default agent.
- Default unset / offline — default is set, online, freshly registered.
- Stale schema — the client_id-declaring build's schema is confirmed live on the agent (model passed the field successfully to dispatch).

## What this suggests

- The rejection happens **after** a well-formed, valid client_id reaches dispatch — so the validator isn't checking presence/format; it's resolving against a registry where even the correct ID doesn't qualify.
- `online_clients` lists **40+ `agent_*` IDs on an account with one registered agent** — a stale or platform-wide registry. If default-resolution picks/injects one of those stale IDs (or injects the literal sentinel `default_client`, which the error itself warns against), every invoke would fail exactly this way.
- Possibly related: BYOK main-model sessions may take a dispatch path that misses the user/agent binding entirely (can't test an Anna-hosted model — plan energy is 0).

## Asks

1. Is `client_id` injection into chat-session executa invokes expected to resolve the user's default agent? Is the resolution known-broken for BYOK-main-model sessions?
2. Should `online_clients` be scoped to the account's registered agents? The current list looks platform-wide or accumulated across historical registrations.
3. Any server-side flag/session state we can clear to force a clean client binding?
