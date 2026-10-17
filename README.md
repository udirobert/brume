# Imperfect Breath

> A wellness platform for guided breathing with optional AI coaching and camera feedback

**Live Demo**: [Try Now](https://brumeapp.netlify.app) | **API**: [api.imperfectform.fun](https://api.imperfectform.fun)

## 🎯 What is Imperfect Breath?

A wellness platform combining ancient breathing wisdom with modern technology:

- **🫁 Ancient Techniques** - Traditional patterns from around the world
- **🤖 AI Coaching** - Real-time personalized guidance with Zen AI agent
- **📱 Camera Feedback** - Optional camera-based movement feedback (not biometric validation)
- **⛓️ Web3 Integration** - NFTs, social features, and community
- **👥 Social Platform** - Connect with practitioners worldwide

**Core Philosophy:** Progress over perfection, consistency over intensity, mindful awareness over mechanical practice.

## 🚀 Quick Start

### For Users
**[🌐 Live Demo](https://brumeapp.netlify.app)** - Start breathing immediately, no signup required!

### For Developers

Prerequisites: **Node.js `>=24.15.0 <25`** (see `.nvmrc`) and **pnpm 12.14.0** (`corepack enable` reads `packageManager`).

> **Install policy:** `pnpm-workspace.yaml` is tracked and applies pnpm 12's default `minimumReleaseAge` gate for all packages, with exact-pin `minimumReleaseAgeExclude` exceptions only for the two latest-pinned releases (`eslint@10.13.0`, `lucide-react@1.58.0`). The lockfile is multi-document; always install with `pnpm install --frozen-lockfile`.

```bash
# Clone and install
git clone https://github.com/udirobert/brume.git
cd brume
pnpm install --frozen-lockfile

# Start development (includes fallback AI)
pnpm dev  # Opens http://localhost:4556

# Optional: Enable full AI & vision features
cd backend/vision-service
pip install -r requirements.txt
MODEL_DOWNLOAD_ON_START=false python3 main.py &
```

**Works immediately with:** 20+ breathing patterns, progress tracking, offline support

## 📚 Documentation

### 🚀 **[Development Guide](docs/DEVELOPMENT.md)** - Setup, roadmap, and implementation
### 🏗️ **[Architecture Guide](docs/ARCHITECTURE.md)** - System design & technical details
### 📖 **[Documentation Hub](docs/README.md)** - Additional guides and resources

## 🌟 Key Features

### 🤖 AI-Powered Coaching
- **Optional camera feedback** — image frames are sent to Brume's backend and processed with MediaPipe for face-landmark and movement estimates (not a clinical or breath-quality measurement)
- **Personalized insights** powered by Cerebras & Llama AI models
- **Zen AI agent** for adaptive guidance and encouragement
- **Session intelligence** - Detailed metrics and progress tracking

### 📱 Progressive Web App
- Works offline after first load
- Mobile-optimized responsive design
- Camera integration for vision features

### ⛓️ Trust layer (quiet by design)
- **Flow Blockchain / Lens Protocol** — legacy credential plumbing exists in the codebase, but camera presence does not verify breathing and post-session credential minting is currently not user-facing. Don't treat it as proof of practice.
- **Wallet connect** — reserved for credentials; nothing else asks for it

## 🔒 Privacy & Security

**Camera Processing:** Optional camera feedback captures JPEG image frames and sends them to Brume's backend, where MediaPipe estimates face landmarks and movement. It is not breathing verification or a clinical measurement — sessions work fully without a camera.

**Retention:** Session metrics, preferences, and history may persist (local device and Supabase when signed in). Exact retention/ownership policy needs a backend review — see [docs/DEPENDENCIES.md](docs/DEPENDENCIES.md) for the current dependency and privacy posture.

## 🤝 Contributing

We welcome contributions from developers, breathing instructors, and wellness practitioners!

### Quick Development Commands
```bash
pnpm dev            # Start development server
pnpm run build      # Production build
pnpm test           # Run tests
pnpm run lint       # Code quality checks
```

Frontend startup requires the public Supabase values in `.env.local`, including for guest use (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — publishable anon key only, never service keys). Provider/service keys stay backend-side; do not add `VITE_*` secret keys.

### Contribution Types
- **Breathing Patterns** - Share traditional techniques
- **Code Development** - Improve features and fix bugs
- **Documentation** - Help others learn and use the platform
- **Community** - Support other users and share experiences

## 🌍 Roadmap

### ✅ Completed
- Core breathing patterns and AI coaching
- Computer vision system with three performance tiers
- Flow blockchain integration for NFTs
- Mobile-first responsive design
- Lens Protocol social features

### 🔄 In Development
- Advanced biometrics (HRV, stress detection)
- Instructor certification program
- Multi-language support

### 📋 Future Plans
- Mobile app (iOS/Android)
- Wearable device integration
- Advanced AI coaching features

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with respect for ancient breathing traditions and the open source community.

---

**Start your breathing journey today** - No signup required, just breathe. 🌬️

[Live Demo](https://brumeapp.netlify.app) | [Documentation](docs/) | [Community](https://lens.xyz/u/imperfectbreath)
