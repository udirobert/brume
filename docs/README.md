# Brume - Documentation Hub

## 🎯 **Quick Start**

### **Development**
Requires **Node.js 24** (`>=24.15.0 <25`, see `.nvmrc`) and **pnpm 12.14.0** (`corepack enable` reads `packageManager`).
```bash
pnpm install --frozen-lockfile
pnpm dev
```
See [Dependencies & Toolchain](./DEPENDENCIES.md) for pinned versions, exceptions, and install policy.

### **Production Deployment**
```bash
# Check deployment status
pnpm run deploy

# Deploy vision service
pnpm run deploy:vision

# Configure domain & SSL
pnpm run deploy:domain

# Configure firewall
pnpm run deploy:firewall
```

## 📚 **Documentation**

| Document | Purpose |
|----------|---------|
| [Architecture](./ARCHITECTURE.md) | System design, APIs, and technical details |
| [Development](./DEVELOPMENT.md) | Setup, roadmap, implementation, and testing |
| [Authentication](./AUTHENTICATION.md) | Authentication architecture and implementation |
| [API](./API.md) | API endpoints and integration guides |
| [Testing](./TESTING.md) | Testing strategy and implementation |
| [Hacktoberfest Week 3 draft](./HACKTOBERFEST_WEEK3.md) | DEV submission draft for Hacktoberfest 2026 Week 3 (Slow and Steady) |

## 🏗️ **Architecture**

```
Frontend (React/TypeScript) → API (host migrating off retired imperfectform.fun) → Vision Service (Hetzner)
     ↓                              ↓                           ↓
  Netlify/Vercel              Nginx + SSL                Docker + FastAPI
     ↓                              ↓                           ↓
  Web3 Integration            Rate Limiting              MediaPipe + AI
```

## 🚀 **Core Features**

- **Vision Processing**: Optional camera feedback (face-landmark/movement estimates via backend MediaPipe; not proof of practice)
- **AI Analysis**: Advanced breathing pattern insights
- **Web3 Integration**: Flow blockchain and Lens Protocol
- **Professional API**: SSL-secured domain with rate limiting
- **CI**: GitHub Actions validates lint/typecheck/tests/build; Netlify deploys separately

## 🔧 **Development Commands**

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Start development server |
| `pnpm run build` | Build for production |
| `pnpm run deploy` | Check deployment status |
| `pnpm run setup` | Install dependencies |

## 🌐 **Production URLs**

- **Frontend**: Your Netlify deployment
- **API**: see `docs/` (api.brume.trustfall.xyz)
- **Health Check**: `api.brume.trustfall.xyz/health`

## 📋 **Prerequisites**

- Node.js 24 (`>=24.15.0 <25`, see `.nvmrc`) and pnpm 12.14.0
- Docker (for local vision service)
- Hetzner Cloud account
- GoDaddy domain management
- GitHub repository access

## 🔐 **Security**

- SSL/TLS encryption
- Rate limiting
- CORS protection
- Environment variable isolation
- SSH key authentication

## 📞 **Support**

For issues or questions:
1. Check the documentation in `/docs/`
2. Run `pnpm run deploy` for diagnostics
3. Review GitHub Actions logs
4. Check server logs via SSH

---

**Built with**: React, TypeScript, FastAPI, MediaPipe, Docker, Nginx