# Testing Strategy

Comprehensive testing approach for Brume.

> **Verification status (2026-10-17, post dependency migration):**
> currently installed: **Vitest 5.0.5** + `react-dom`/`act` + **jsdom 30**.
> React Testing Library and MSW are **not** installed — examples below
> referencing them are conceptual, not executed coverage. E2E tests live in
> root `e2e/` (not `src/`) and their fixtures predate current routes
> (e.g. login vs `/auth`) — not a release gate. Recorded at migration:
> unit suite passing, `tsc` clean, eslint 0 errors, production build
> passing. See [DEPENDENCIES.md](./DEPENDENCIES.md) for details.

## Overview

The testing strategy includes:
- Unit tests for individual components
- Integration tests for cross-service operations
- E2E tests for complete user flows
- Performance tests for load scenarios
- Security tests for vulnerability assessment

## Test Structure

```
src/**/__tests__/           # Unit tests (vitest + jsdom)
e2e/                        # Playwright E2E (root-level, stale fixtures)
```

## What is tested today (2026-11-24)

Seven suites, one per surface. None of them needs a network, an account or a
model call.

| Surface | Command | What it pins |
|---|---|---|
| Web app | `pnpm vitest run` | the copy contracts (`copy-claims`, `no-streaks`, `no-wallet`), `checkinLedger`, the metrics wire client map, voice propose-never-commit, feelings/`feelTheme`/room, mascot demeanour, Home and session behaviour |
| Anna bundle | `cd anna && npm test` | node smoke + shared fixtures (`preparation`, `recovery`, `session-storage`, `experience`, `mascot`, `arrive`) |
| Python parity | `cd anna/executas/brume && python3 -m unittest test_plan` | the executa's port of `plan.js` |
| Anna manifest | `cd anna && anna-app validate --strict` | schema and `host_api` ACL |
| MCP app | `cd mcp && npm test` | the plan contract, plus a real jsdom run of the embedded widget (phases → mascot states → single-loop `Again` → `pagehide` cleanup) |
| Voice service | `cd backend/vision-service && python3 -m unittest test_voice_guard` | per-visitor/per-day metering and the optional key |
| Counter | `pnpm vitest run src/lib/__tests__/metrics.test.ts` | the client `WIRE` and the function's `ALLOWED` map stay equal |

Browser QA is the eighth: `cd anna && npm run test:browser` drives a fake host on
`:4618` with a real browser.

**What makes these load-bearing.** Contract tests are parity tests: the metrics
test fails when `WIRE` and `ALLOWED` disagree, `test_plan` fails when the Python
executa drifts from `plan.js`, and `mascot.mjs` pins the engine the web app and
the MCP widget both draw. The claim tests are refusal tests: they fail when copy
invents a health claim, a score or a streak, and `no-wallet.test.ts` fails on an
import of a chain library anywhere under `src/`.

**Not covered, and known to be:** native Capacitor builds (no JDK on the dev
machine, no iOS project), the Playwright `e2e/` fixtures (stale routes — `login`
vs `/auth`), a real phone for room touch, and any assertion about how a real
person feels afterwards. The last one is the qualitative table in
[`EXPERIMENTS.md`](./EXPERIMENTS.md), not a test.

---

# History — the chain-era test plan (kept verbatim, 2026-10)

Everything below describes Flow/Lens wallet flows, NFT minting and AI analysis,
none of which exist in the app. It is kept because it records what was once
considered coverage, and because two of its habits survived: mock the adapter,
not the component, and never assert on copy without the claims list.

## Unit Testing

### Framework
- **Vitest**: Fast unit testing framework
- **React DOM / React `act`**: Component rendering and interaction
- **jsdom / Vitest mocks**: Browser-like test environment and isolated adapters

### Coverage
- Authentication services
- Blockchain clients
- API endpoints
- Utility functions
- UI components

### Examples

These historical examples illustrate intended coverage; they are not the executed migration tests.

```typescript
// Example unit test for authentication
import { describe, it, expect } from 'vitest';
import { useFlowAuth } from '../src/auth/composables/useFlowAuth';

describe('Flow Authentication', () => {
  it('should initialize with correct capabilities', () => {
    const { capabilities } = useFlowAuth();
    expect(capabilities).toBeDefined();
    expect(capabilities.scheduledTransactions).toBeTypeOf('boolean');
  });
});
```

## Integration Testing

### Scope
- Cross-service data synchronization
- Authentication flow coordination
- Blockchain transaction processing
- Social network integration

### Examples

```typescript
// Example integration test for cross-network coordination
import { describe, it, expect } from 'vitest';
import { CrossNetworkIntegration } from '../src/lib/flow/cross-network/cross-network-integration';

describe('Cross-Network Integration', () => {
  it('should create social post when NFT is minted', async () => {
    const integration = new CrossNetworkIntegration();
    const result = await integration.postMintToLens({
      nft: mockNFT,
      transactionId: 'tx-123',
      uniqueId: 'unique-123',
      creatorAddress: '0x123'
    });
    
    expect(result).not.toBeNull();
    expect(result?.id).toBeDefined();
  });
});
```

## E2E Testing

### Framework
- **Playwright**: Cross-browser testing framework
- **Docker**: Test environment isolation

### Test Scenarios

#### Authentication Flow
- Email registration and login
- Wallet connection and authentication
- Lens Protocol integration
- Flow blockchain authentication

#### Breathing Session Flow
- Pattern selection and session start
- Session completion and data saving
- AI analysis and feedback

#### NFT Marketplace Flow
- Browsing available patterns
- Minting new breathing pattern NFTs
- Purchasing existing NFTs

#### Social Features Flow
- Posting to social feed
- Following other users
- Liking and commenting on posts

#### Cross-Network Integration Flow
- Minting NFTs with social sharing
- Creating breathing challenges
- Cross-network reward distribution

### Examples

```typescript
// Example E2E test for authentication
import { test, expect } from '@playwright/test';

test('should allow user to register with email', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('SecurePassword123!');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Welcome to Brume')).toBeVisible();
});
```

## Performance Testing

### Tools
- **Lighthouse**: Web performance auditing
- **WebPageTest**: Real-world performance testing
- **Artillery**: Load testing

### Metrics
- Page load time
- Time to interactive
- Bundle size
- API response time
- Blockchain transaction time

### Examples

```javascript
// Example load test configuration
export const config = {
  target: 'http://localhost:4556',
  phases: [
    {
      duration: 60,
      arrivalRate: 5,
      name: 'Warm up',
    },
    {
      duration: 120,
      arrivalRate: 5,
      rampTo: 50,
      name: 'Ramp up load',
    },
    {
      duration: 600,
      arrivalRate: 50,
      name: 'Sustained max load',
    },
  ],
};
```

## Security Testing

### Tools
- **OWASP ZAP**: Automated security scanning
- **Snyk**: Dependency vulnerability scanning
- **Custom Security Audit Script**: Codebase security checks

### Checks
- Exposed secrets
- Insecure code patterns
- Missing security headers
- Vulnerable dependencies

### Examples

```javascript
// Example security audit check
const SECRET_PATTERNS = [
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

for (const { name, pattern } of SECRET_PATTERNS) {
  if (pattern.test(fileContent)) {
    console.log(`🚨 ${name} found in ${filePath}`);
  }
}
```

## Test Execution

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Security Audit
```bash
npm run security:audit
```

### Continuous Integration
All tests run automatically on GitHub Actions:
- Unit tests on every push
- E2E tests on pull requests
- Security audit weekly
- Performance tests on deployment

## Code Coverage

Target coverage thresholds:
- Unit tests: 80%
- Integration tests: 70%
- E2E tests: 60%

Coverage reports generated automatically:
- HTML reports for local development
- CI integration for pull requests
- Coverage badges for documentation