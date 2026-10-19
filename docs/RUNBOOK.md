# Shipaton Console Runbook

> The dashboard-side tasks only a human with the accounts can do, in dependency order.
> Code side is ready (branch `feat/brume`). Today: Aug 27. Public release target: **Sep 3**. Submission deadline: **Sep 30**.

## 1. Apple Developer account — TODAY (longest lead)

1. Enroll at developer.apple.com ($99/yr). Individual enrollment is fastest (org needs D-U-N-S).
2. When active: App Store Connect → create app **Brume**, bundle id `xyz.trustfall.brume`.
3. Add the iOS platform to Capacitor: `npx cap add ios` (code side, do when account exists).
4. Store review prep: camera permission string = *"Brume uses your camera to verify your breathing practice. Video never leaves your device."* — this exact framing matters; reviewers reject vague health-adjacent copy.

## 2. RevenueCat (unblocks paywall testing + judge promo codes)

1. Create project **Brume** → add iOS + Android apps.
2. **Entitlement**: `brume_premium` (must match `ENTITLEMENT_ID` in `src/lib/monetization/revenueCatConfig.ts`).
3. **Products** (create in App Store Connect / Play Console, link in RC):
   - `brume_premium_monthly` — monthly
   - `brume_premium_annual` — annual **with 7-day free trial** (trial = judge access path + Shipaton requirement)
4. Attach both products to the entitlement; create an Offering "default" with both packages.
5. Keys: public SDK keys into `VITE_` env or backend `revenuecat_config.py` endpoint (existing plumbing).
6. Create **promo codes** for judges (App Store: promo codes; Play: promo codes) — needed at submission.

## 3. OneSignal (Keep Them Coming Back award)

1. New app **Brume**. Platforms: Android + iOS.
2. Android: Firebase project → FCM → drop `google-services.json` into `android/app/` (gradle already guards for it).
3. iOS: APNs auth key.
4. Set `VITE_ONESIGNAL_APP_ID` in env. Client code is wired (`src/lib/notifications/oneSignal.ts`).
5. **Create 3 Journeys against the tag contract** (docs/BRUME.md §OneSignal):
   - *First Breath*: user created 24h ago AND `first_breath_done` absent → "Your first verified breath is waiting"
   - *Streak Rescue*: `streak` ≥ 1 AND `last_session_at` stale ≥ 1 day → "Your mist is waiting"
   - *Weekly Proof*: Sunday weekly, segment `verified_total` ≥ 1 → digest message

## 4. Google Play Console (release vehicle — Sep 3)

1. Create app `xyz.trustfall.brume`, name **Brume**.
2. Internal testing track → upload AAB (`cd android && ./gradlew bundleRelease`).
3. Data safety form: camera = "used on-device, not collected" (matches Privacy Policy — keep them consistent or review fails).
4. Content rating: Everyone. Health claims: wellness only, no medical claims (Terms already say this).
5. Internal → closed → **production release Sep 3** (review can take 3–7 days; submit closed track ~Sep 1).

## 5. Store listing copy (paste-ready)

- **Short**: Camera-verified breathwork. Progress you can prove.
- **Full**: Brume watches you breathe — on-device, nothing uploaded — coaches you through your actual state, and turns practice into verified records. Every other breathwork app is a timer with audio; Brume knows you practiced. Build streaks that can't be faked, share verified credentials, and let Zen, your AI coach, show its reasoning.

## 6. Submission week (Sep 21–30)

- [ ] ≤2-min video: state check-in → verified session → credential card → share (record on device)
- [ ] 1024×1024 icon (mist mark on brume-900 `#22303c`)
- [ ] 1179×2556 screenshot, no device frame
- [ ] Judge promo codes from step 2.6
- [ ] Devpost text: lead with the monopoly line + two-sided monetization (consumer IAP + agent API)
- [ ] Submit by Sep 28 (buffer before Sep 30 hard deadline)

## 7. Domain

- `brumeapp.netlify.app` → Netlify deploy of the PWA build; agent API docs at `/agents` later.

## 8. Flow PracticeCredential verifier (on-chain attestations)

The `PracticeCredential` contract only accepts credentials co-signed by an
**authorized verifier**. The Brume backend is that verifier. Setup (once per
environment — emulator/testnet/mainnet):

1. **Generate a secp256k1 keypair** for the backend:
   ```
   flow keys generate --sig-algo ECDSA_secp256k1
   ```
   Keep the private key secret; the public key goes on-chain.

2. **Create (or reuse) a Flow account for the verifier** and register that
   public key on it:
   ```
   flow accounts create --key <PUBLIC_KEY_HEX> \
     --sig-algo ECDSA_secp256k1 --hash-algo SHA3_256 \
     --signer <funder> --network <network>
   ```
   The resulting address is `BRUME_VERIFIER_ADDRESS`.

3. **Deploy `PracticeCredential`** (already wired into `flow.json`) and
   **allowlist the verifier** (run by the contract deployer/admin):
   ```
   flow project deploy --network <network>
   flow transactions send cadence/transactions/setup_verifier.cdc \
     <BRUME_VERIFIER_ADDRESS> --signer <admin> --network <network>
   ```
   `setup_verifier` stores the `VerifierAdmin` resource on first run, then adds
   the verifier. Use `remove_verifier.cdc` to rotate/revoke.

4. **Set backend env** on the vision service:
   - `BRUME_VERIFIER_KEY`  = the private key hex (step 1)
   - `BRUME_VERIFIER_ADDRESS` = the verifier account address (step 2), `0x…`

5. **Set frontend env**: `VITE_PRACTICE_CREDENTIAL_ADDRESS` (contract address)
   and `VITE_BRUME_VERIFIER_ADDRESS` (same as step 4).

**How it stays honest:** `/api/attest` ignores the client's `verified` flag and
`session_score`; it requires ≥10 real camera frames in the session store and
computes the score from the session's own breathing data. It then signs
`sessionId || subject.toString() || score.toString()` (the exact bytes the
contract reconstructs) with ECDSA/secp256k1 over `SHA3-256(pad32(tag) || data)`,
tag `Brume-PracticeCredential-v1`. The contract rejects any credential whose
verifier isn't allowlisted, whose signature doesn't check out, or whose
score/subject doesn't match the signed payload — so a user can't self-issue or
inflate a score. Verified end-to-end against the Flow emulator (happy path +
forged-sig / wrong-score / replay / unauthorized-verifier all reject).
