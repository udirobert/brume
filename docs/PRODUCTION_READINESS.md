# Production Readiness Checklist: Brume

## 🚀 Priority 1: Launch Foundations (Critical)

### 1. Environment & Infrastructure
- [ ] **Backend API Persistence**: Ensure FastAPI (Hetzner) is running with a process manager (PM2/Systemd).
- [ ] **AI Backend Keys**: Configure secure environment variables on the Hetzner server:
    - [ ] `CEREBRAS_API_KEY`: For ultra-fast Llama-based analysis.
    - [ ] `GEMINI_API_KEY`: For multimodal Google Gemini insights.
    - [ ] `OPENAI_API_KEY`: For GPT-4o-mini fallback analysis.
- [ ] **Production Supabase**: Move from development/test project to production project.
- [ ] **SSL Certification**: Verify `api.brume.trustfall.xyz` has a valid, auto-renewing Certbot/LetsEncrypt certificate.

### 2. Error Monitoring & Reliability
- [ ] **Sentry Integration**: Initialize Sentry on both frontend and backend.
- [ ] **Unified Error Handling**: (✅ COMPLETE) Toast system integrated with `useErrorHandler`.
- [ ] **Graceful Fallbacks**: Ensure AI features degrade gracefully if the backend is unreachable.

## 🛠️ Priority 2: Security & Hardening

### 3. API Security
- [ ] **Rate Limiting**: Implement rate limiting on the FastAPI backend to prevent abuse.
- [ ] **CORS Hardening**: Restrict `allow_origins` to only domestic production domains.
- [ ] **Key Rotation**: Establish a schedule for rotating critical blockchain and AI API keys.

### 4. Smart Account & Wallets
- [ ] **Mainnet Transition**: Update `BlockchainAuthService` to point to Flow Mainnet and Lens Mainnet.
- [ ] **Trust layer deployment**: Deploy `PracticeCredential` to testnet → mainnet,
    create the verifier account, set `BRUME_VERIFIER_KEY` / `BRUME_VERIFIER_ADDRESS`,
    run `setup_verifier.cdc` — full procedure in `docs/RUNBOOK.md` §8.
- [ ] **Policy Updates**: Finalize ERC-7715 execution policies for production permissions.

## 📱 Priority 3: Distribution & Mobile

### 5. Capacitor Build
- [ ] **Bundle IDs**: Finalize `xyz.trustfall.brume` for iOS and Android.
- [ ] **App Icons & Splash**: Generate high-quality assets using the brand guidelines.
- [ ] **RevenueCat Webhooks**: Set up webhooks between RevenueCat and Supabase to sync subscription status.

### 6. Regulatory & Legal
- [ ] **Privacy Policy**: (✅ COMPLETE) Basic policy template created; needs legal review.
- [ ] **Terms of Service**: (✅ COMPLETE) Basic terms template created; needs legal review.
- [ ] **App Store Metadata**: Prepare screenshots and descriptions for the App Store/Play Store.
