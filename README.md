# Brume

> A calm companion for the two minutes between things. Nothing to get right, nothing to prove.

**Live Demo**: [Try Now](https://brumeapp.netlify.app) | **Anna App Store**: @papa/brume

## 🎯 What is Brume?

Brume is a mist sprite who breathes with you. Two faces, one character:

- **🌐 Web app** ([brumeapp.netlify.app](https://brumeapp.netlify.app)) - the full practice: guided breathing patterns, a two-minute Decompress check-in, and session history — no camera, no account needed.
- **🤖 Anna app** (`anna/`, [@papa/brume](https://anna.partners)) - the pocket version inside the Anna agent. The result is a preparation card for one conversation: the model drafts the words, the person keeps them, and the card may not add a count, a day, or a time they did not write. A breathing break, Arrive, and a one-minute alertness check stay optional. No camera, no account.

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
```

**Works immediately with:** 20+ breathing patterns, progress tracking, offline support

## 📚 Documentation

### 🚀 **[Development Guide](docs/DEVELOPMENT.md)** - Setup, roadmap, and implementation
### 🏗️ **[Architecture Guide](docs/ARCHITECTURE.md)** - System design & technical details
### 📖 **[Documentation Hub](docs/README.md)** - Additional guides and resources

## 🌟 Key Features

### 📱 Progressive Web App
- Works offline after first load
- Mobile-optimized responsive design

### ⛓️ Trust layer (quiet by design)
- **Flow Blockchain / Lens Protocol** — legacy credential plumbing exists in the codebase, but camera presence does not verify breathing and post-session credential minting is currently not user-facing. Don't treat it as proof of practice.
- **Wallet connect** — reserved for credentials; nothing else asks for it

## 🔒 Privacy & Security

**Camera:** The web app does not use your camera. Session history is stored on your device, and in Supabase if you sign in.

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
