# Architecture Overview

Technical architecture and system design for Brume.

## System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Blockchain    │
│   (React/PWA)   │◄──►│  (Python/FastAPI)│◄──►│  (Flow/Lens)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Local Storage │    │    Supabase      │    │      IPFS       │
│   (IndexedDB)   │    │   (PostgreSQL)   │    │  (Metadata)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Frontend Architecture

### Technology Stack
- **React 18** + **TypeScript** - UI framework
- **Vite** - Build tool & dev server
- **Tailwind CSS** + **shadcn/ui** - Styling
- **Zustand** - State management
- **TensorFlow.js** - Computer vision
- **PWA** - Offline capabilities

### Key Components
```typescript
// Core breathing session
BreathingSession/
├── PatternSelector     # Choose breathing pattern
├── SessionControls     # Start/pause/stop
├── VisionFeedback     # Camera & AI analysis
├── ProgressDisplay    # Real-time metrics
└── SessionSummary     # Results & insights

// AI & Vision
VisionSystem/
├── CameraCapture           # Video stream handling
├── FaceMeshDetection       # MediaPipe integration
├── BreathingAnalysis       # Pattern recognition
├── EnhancedEmotionalOverlay # Advanced FACS-based emotional analysis
├── EmotionalPatternAdapter # Smart breathing recommendations based on emotional state
├── EnhancedVisionManager   # Integration layer for emotional analysis
├── EmotionalSessionInsights # Post-session emotional journey insights
├── PreSessionPreparation  # Intelligent preparation with personality detection
├── DynamicSessionEnhancer # Real-time session adaptation based on emotional feedback
├── ComprehensiveSessionOrchestrator # Complete session journey orchestration
└── AICoaching             # Personalized feedback

// Vision Hooks
├── useEmotionalAnalysis    # Hook for emotional analysis integration

// Web3 Integration
Web3Features/
├── WalletConnection   # Multi-chain support
├── NFTMinting         # Session achievements
├── SocialFeatures     # Lens Protocol
└── Marketplace        # Pattern trading
```

### State Management
```typescript
interface AppState {
  session: SessionStore      // Current breathing session
  user: UserStore           // Authentication & profile
  vision: VisionStore       // Camera & AI analysis
  web3: Web3Store          // Blockchain interactions
  settings: SettingsStore   // User preferences
}
```

## Backend Architecture

### Services
```python
# FastAPI application
backend/vision-service/
├── main.py              # API routes & middleware
├── vision_processor.py  # MediaPipe processing
├── ai_analysis.py       # Session insights
├── revenuecat_config.py # Monetization
└── webhook_handler.py   # External integrations
```

### API Endpoints
```
GET    /health                           # Service status
POST   /api/vision/process               # Frame analysis (MediaPipe)
GET    /api/vision/sessions/{id}/summary # Session summary
GET    /api/vision/sessions              # List sessions
POST   /api/vision/session/{id}/stop     # Stop a session
DELETE /api/vision/session/{id}          # Discard session data
POST   /api/ai-analysis                  # AI insights
POST   /api/ai-analysis-stream           # Streaming AI insights
POST   /api/attest                       # ProofOfPractice attestation (server-verified)
GET    /api/session/{id}/verify-status   # Camera-verification status
POST   /lens/sign-session                # Lens session signing (quiet infra)
GET    /revenuecat                       # Monetization config
```

### Data Flow
1. **Frame Capture**: Frontend captures video frames
2. **Processing**: Backend analyzes with MediaPipe
3. **AI Analysis**: Generate insights & recommendations
4. **Storage**: Save session data (local + cloud)
5. **Attestation**: optional user-initiated credential minting (backend co-signs only after server-side camera verification)

## Database Schema

### Supabase Tables
```sql
-- User management
users (
  id uuid PRIMARY KEY,
  email text,
  wallet_address text,
  created_at timestamp
);

-- Breathing sessions
sessions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  pattern_name text,
  duration integer,
  metrics jsonb,
  created_at timestamp
);

-- Custom patterns
patterns (
  id uuid PRIMARY KEY,
  creator_id uuid REFERENCES users(id),
  name text,
  config jsonb,
  is_public boolean
);
```

### Local Storage (IndexedDB)
```typescript
interface LocalSession {
  id: string;
  timestamp: number;
  pattern: BreathingPattern;
  metrics: SessionMetrics;
  visionData?: VisionAnalysis;
}
```

## Authentication Architecture

### Multi-Chain Authentication Support

**Supported Combinations:**
- Email + Lens + Flow + Wallet = Complete Web3 experience
- Lens only = Social-focused experience
- Flow only = NFT/Creator-focused experience
- Traditional email = Basic experience with upgrade path

### Authentication Flow States
```typescript
interface AuthState {
  // Core authentication
  user: unknown;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Multi-chain states (optional)
  wallet?: { address: string; isConnected: boolean };
  flowUser?: { address: string; loggedIn: boolean };
  lensProfile?: { id: string; handle: string; name?: string };
}
```

### Core Components

#### 1. UnifiedAuthFlow
Handles method selection and shows connection status for all methods.

#### 2. ConsolidatedAuthGate
Single auth gate for all use cases with flexible fallback strategies.

#### 3. LazyWalletAuth
Lazy-loaded with conflict detection and connection timeout protection.

### Platform Compatibility

#### Web Platform
- **Mock implementations** for development
- **Graceful degradation** for unsupported features
- **Clear upgrade paths** to mobile for full functionality

#### Mobile Platform (iOS/Android)
- **Full RevenueCat integration** for subscriptions
- **Native wallet connections** via Capacitor
- **Complete Web3 functionality**

## Blockchain Integration

### Flow Blockchain — PracticeCredential (credentials, not collectibles)

Non-transferable attestations of camera-verified practice. Contract:
`cadence/contracts/PracticeCredential.cdc`.

- **Records, not assets**: no withdraw/transfer is exposed; a credential
  cannot be sold or moved (see STRATEGY — attestations, not collectibles).
- **Issuance is two-party**: the user submits the Flow transaction (keys stay
  client-side), but the contract only accepts a credential whose payload
  (`sessionId || subject.toString() || score.toString()`) carries a valid
  co-signature from an **authorized verifier** — the Brume backend.
- **The backend signs only after server-side verification**: the session must
  have accumulated real camera frames (≥10) in the vision processor, and the
  score is computed server-side from the session's own breathing data. The
  client cannot supply or inflate either. Signature scheme: ECDSA/secp256k1
  over `SHA3-256(pad32(tag) || payload)`, tag `Brume-PracticeCredential-v1`.
- **Verifier management**: allowlist admin via
  `cadence/transactions/setup_verifier.cdc` / `remove_verifier.cdc`
  (operational steps in RUNBOOK §8).

### Lens Protocol V3

Quiet infrastructure, not a destination: session signing for verifiable
practice records (`POST /lens/sign-session`). The social surfaces (hub,
composer, feed) were buried in consolidation round 1 and deleted in round 3.

## Security Architecture

### Data Protection
- **Client-side**: No sensitive data in localStorage
- **Transport**: HTTPS/WSS for all communications
- **Storage**: Encrypted user data in Supabase
- **Blockchain**: Non-reversible session hashes

### Privacy by Design
```typescript
interface PrivacyControls {
  dataRetention: '30d' | '1y' | 'forever';
  shareMetrics: boolean;
  allowAnalytics: boolean;
  exportData: () => UserData;
  deleteAccount: () => Promise<void>;
}
```

## Emotional Analysis Architecture

The emotional analysis system implements advanced FACS (Facial Action Coding System) capabilities with the following architectural principles:

### Core Principles
- **ENHANCEMENT FIRST**: Builds on existing `FaceMeshOverlay` and `VisionManager`
- **AGGRESSIVE CONSOLIDATION**: Single emotional analysis system to prevent feature fragmentation
- **PREVENT BLOAT**: Optional features that can be disabled without affecting core functionality
- **DRY**: Shared emotional analysis logic in reusable components
- **CLEAN**: Clear separation between basic face tracking and emotional analysis
- **MODULAR**: Each emotional analysis component works independently
- **PERFORMANT**: Client-side processing reduces server dependency and preserves privacy

### Component Integration
The emotional analysis system integrates seamlessly with existing vision components through:
- **Enhanced Vision Manager**: Maintains backward compatibility with existing `VisionManager`
- **Hook-based Integration**: `useEmotionalAnalysis` hook allows gradual adoption
- **Progressive Enhancement**: Emotional features can be enabled/disabled without breaking existing functionality

### Privacy & Security
- **Local Processing**: All emotional analysis happens client-side to preserve privacy
- **Minimal Data Storage**: Emotional data is session-scoped and cleared after sessions
- **User Control**: Emotional analysis can be fully disabled by users
- **Anonymized Insights**: No personally identifiable emotional data is stored or transmitted

### Performance Considerations
- **Client-Side Processing**: No server dependency for real-time emotional analysis
- **Optimized Frame Rate**: 2fps analysis balances accuracy with performance
- **WebGL Optimizations**: For efficient landmark processing
- **Memory Management**: Keeps only recent emotional history to prevent memory bloat

### API Integration
The emotional analysis extends the existing vision API without breaking changes, adding emotional state data to the analysis response when enabled.

### API Reference

### Vision Service API

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### Process Frame
```http
POST /api/vision/process
Content-Type: application/json

{
  "frame": "base64-encoded-image",
  "sessionId": "session-uuid",
  "timestamp": 1640995200
}
```

### Enhanced Process Frame Response with Emotional Analysis
When emotional analysis is enabled, the response includes additional emotional state data:

**Response:**
```json
{
  "success": true,
  "analysis": {
    "breathingPhase": "inhale|hold|exhale",
    "confidence": 0.85,
    "landmarks": [[x, y, z], ...],
    "metrics": {
      "breathRate": 12,
      "consistency": 0.8
    },
    "emotionalState": {
      "dominantEmotion": "calm|tension|joy|neutral",
      "duchenneMarker": true,
      "stressIndicators": {
        "browTension": 0.7,
        "facialAsymmetry": 0.3,
        "eyeWidening": 0.2
      },
      "relaxationScore": 85,
      "smileVector": {
        "authenticity": 0.9,
        "intensity": 0.6
      }
    }
  }
}
```

### AI Analysis API

#### Generate Insights
```http
POST /api/ai-analysis
Content-Type: application/json

{
  "sessionData": {
    "pattern": "4-7-8",
    "duration": 600,
    "metrics": {...}
  },
  "userHistory": [...]
}
```

**Response:**
```json
{
  "insights": [
    "Great consistency in breath holds",
    "Try extending exhale phase for deeper relaxation"
  ],
  "recommendations": [
    "Consider 6-7-8 pattern for next session",
    "Focus on smooth transitions between phases"
  ],
  "score": 85
}
```

### Frontend Hooks

#### useSession Hook
```typescript
import { useSession } from '@/hooks/useSession';

const MyComponent = () => {
  const {
    startSession,
    pauseSession,
    endSession,
    currentPhase,
    timeRemaining,
    metrics
  } = useSession();

  const handleStart = () => {
    startSession({
      pattern: '4-7-8',
      duration: 600,
      enableVision: true,
      enableEmotionalAnalysis: true // Enable emotional analysis for enhanced feedback
    });
  };

  return (
    <div>
      <p>Phase: {currentPhase}</p>
      <p>Time: {timeRemaining}s</p>
      <p>Emotional State: {metrics.emotionalState?.dominantEmotion || 'Not detected'}</p>
      <p>Relaxation Score: {metrics.emotionalState?.relaxationScore || 'N/A'}</p>
      <button onClick={handleStart}>Start</button>
    </div>
  );
};
```

#### Integration with EnhancedVisionManager
To use the enhanced emotional analysis features, replace your existing `VisionManager` with `EnhancedVisionManager`:

```typescript
// Before
import { VisionManager } from './VisionManager';

// After
import { EnhancedVisionManager } from './EnhancedVisionManager';

<EnhancedVisionManager
  // All existing props work
  enabled={true}
  videoRef={videoRef}
  cameraStream={cameraStream}
  sessionId={sessionId}

  // New emotional analysis props
  emotionalAnalysisEnabled={true}
  showDetailedEmotrics={false} // Start minimal
  onPatternRecommendation={handleRecommendation}
  currentPatternId={currentPattern}
/>
```

#### useVision Hook
```typescript
import { useVision } from '@/hooks/useVision';

const VisionComponent = () => {
  const {
    isActive,
    startVision,
    stopVision,
    analysis,
    error
  } = useVision();

  useEffect(() => {
    if (isActive && analysis) {
      console.log('Breathing phase:', analysis.breathingPhase);
    }
  }, [analysis]);

  return (
    <div>
      {error && <p>Error: {error}</p>}
      <button onClick={startVision}>Enable Camera</button>
    </div>
  );
};
```

#### useEmotionalAnalysis Hook
For emotional analysis integration, use the `useEmotionalAnalysis` hook:

```typescript
import { useEmotionalAnalysis } from '@/hooks/useEmotionalAnalysis';

const EmotionalVisionComponent = () => {
  const emotionalAnalysis = useEmotionalAnalysis({
    enabled: true,
    insightLevel: 'moderate', // 'minimal', 'moderate', or 'detailed'
    autoRecommendations: false, // Allow pattern recommendations based on emotions
    sessionData: currentSessionData
  });

  // Process emotional data from your existing vision system
  useEffect(() => {
    if (emotionalData) {
      emotionalAnalysis.processEmotionalState(emotionalData);
    }
  }, [emotionalData]);

  // Get recommendations when needed
  const recommendation = emotionalAnalysis.getPatternRecommendation(currentPattern);

  return (
    <div>
      <p>Emotional State: {emotionalAnalysis.currentEmotionalState}</p>
      <p>Relaxation Score: {emotionalAnalysis.relaxationScore}</p>
      {recommendation && (
        <button onClick={() => handleRecommendation(recommendation)}>
          Try Recommended Pattern
        </button>
      )}
    </div>
  );
};
```

## Attestation APIs (trust layer)

#### 1. Request the attestation — `POST /api/attest`

```typescript
// src/hooks/useAttestation.ts (simplified)
const res = await fetch(`${BACKEND_URL}/api/attest`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    session_id: sessionId,      // capability: must exist in the vision session store
    wallet_address: address,    // the user's FLOW address (the tx submitter)
  }),
});
const data = await res.json();
// data.credential.metrics.session_score  — computed server-side
// data.verifier_signature                — co-signature for the Flow transaction
```

The backend refuses unless the session accumulated ≥10 real camera frames,
ignores any client-supplied score, and signs the canonical payload
`sessionId || subject.toString() || score.toString()`.

#### 2. Mint user-initiated — `attestPracticeOnChain`

```typescript
// src/lib/flow/attest-practice.ts (simplified)
await attestPracticeOnChain({
  sessionId,
  score: data.credential.metrics.session_score, // must match the signed value
  verifierSignature: data.verifier_signature,
});
```

Submits `cadence/transactions/attest_practice.cdc`. The contract
(`PracticeCredential.attest`) panics unless the verifier is allowlisted, the
signed payload matches the transaction's subject/score exactly, and the
signature verifies against the verifier account's key — so self-issuance,
score inflation, and cross-account replay are all impossible.

## Configuration

### Environment Variables
```bash
# Required for enhanced features (optional)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
VITE_GEMINI_API_KEY=your_gemini_key
VITE_HETZNER_SERVICE_URL=https://api.brume.trustfall.xyz

# Blockchain (optional)
VITE_FLOW_ACCESS_NODE=https://rest-testnet.onflow.org
VITE_LENS_API_URL=https://api-v2-mumbai.lens.dev
```

### API Client Configuration
```typescript
// src/lib/api/unified-client.ts
export const apiClient = {
  vision: new VisionAPI({
    baseURL: import.meta.env.VITE_HETZNER_SERVICE_URL || 'http://localhost:8001'
  }),

  ai: new AIAnalysisAPI({
    provider: 'gemini', // or 'openai', 'anthropic'
    apiKey: import.meta.env.VITE_GEMINI_API_KEY
  }),

  social: new LensAPI({
    baseURL: import.meta.env.VITE_LENS_API_URL
  })
};
```

## Error Handling

### Standard Error Response Format
```typescript
interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### Error Handling Patterns
```typescript
// Frontend error handling
const handleAPIError = (error: APIError) => {
  switch (error.error.code) {
    case 'VISION_CAMERA_ERROR':
      // Fallback to manual mode
      setVisionEnabled(false);
      break;
    case 'AUTH_REQUIRED':
      // Redirect to auth
      navigate('/auth');
      break;
    default:
      // Generic error handling
      showToast(error.error.message, 'error');
  }
};
```

## Performance Optimizations

### Frontend
- **Code Splitting**: Route-based lazy loading
- **Image Optimization**: WebP with fallbacks
- **Caching**: Service worker for offline use
- **Bundle Size**: Tree shaking & compression

### Backend
- **Connection Pooling**: Database connections
- **Caching**: Redis for session data
- **Rate Limiting**: API endpoint protection
- **Monitoring**: Health checks & metrics

## Deployment Architecture

### Production Stack
```yaml
# docker-compose.yml
services:
  frontend:
    image: nginx:alpine
    ports: ["80:80", "443:443"]

  backend:
    image: python:3.11-slim
    ports: ["8001:8001"]
    environment:
      - ENV=production

  database:
    image: postgres:15
    volumes: ["./data:/var/lib/postgresql/data"]
```

### CI/CD Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - uses: netlify/actions/deploy@master
```

## Monitoring & Analytics

### Application Metrics
- Session completion rates
- Feature usage patterns
- Performance benchmarks
- Error tracking

### Business Metrics
- User acquisition & retention
- Pattern creation & sharing
- NFT minting activity
- Revenue tracking

## Scalability Considerations

### Horizontal Scaling
- Stateless backend services
- Database read replicas
- CDN for static assets
- Load balancing

### Vertical Scaling
- Optimized algorithms
- Efficient data structures
- Memory management
- CPU utilization
