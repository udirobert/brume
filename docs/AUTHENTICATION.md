# Authentication Architecture

> **Status: historical (2026-08 → 2026-11-04).** This describes wallet, SIWE,
> Flow and Lens sign-in. All of it was cut on 4 November 2026: sign-in is an
> email and a password through Supabase, the app is complete signed out, and
> `src/lib/__tests__/no-wallet.test.ts` fails on an import of a chain library
> anywhere under `src/`. The current account shape is `src/types/user.ts`.

Comprehensive authentication system supporting multiple methods with unified user experience.

## Overview

The authentication system provides seamless integration across four authentication methods:
- **Email Authentication**: Traditional email/password with Supabase
- **Wallet Authentication**: Web3 wallet connection with EVM compatibility
- **Lens Protocol v3**: Social profile integration with decentralized identity
- **Flow Forte**: Blockchain authentication with scheduled transactions support

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Auth Orchestration                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Email     │  │   Wallet    │  │    Lens     │  │    Flow     │ │
│  │   Auth      │  │   Auth      │  │   Auth      │  │   Auth      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      RevenueCat Integration                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Email     │  │   Wallet    │  │    Lens     │  │    Flow     │ │
│  │   Sync      │  │   Sync      │  │   Sync      │  │   Sync      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Email Authentication
- Uses Supabase Auth for secure email/password authentication
- Implements secure token management
- Provides graceful fallbacks for all environments
- Supports developer override capabilities

### Wallet Authentication
- Supports EVM-compatible wallets (MetaMask, WalletConnect, etc.)
- Implements Web3 signature verification
- Provides chain detection and multi-chain support
- Integrates with blockchain services for NFT minting

### Lens Protocol v3 Authentication
- Implements challenge-response authentication flow
- Supports Grove storage integration for content publishing
- Provides account abstraction support
- Enables gasless transactions where applicable

### Flow Forte Authentication
- Implements Flow blockchain authentication
- Supports scheduled transactions for future execution
- Integrates with Flow Actions framework
- Provides WebAuthn authentication options

## RevenueCat Integration

All authentication methods integrate with RevenueCat for subscription management:
- Unified user identification across all auth methods
- Secure key management avoiding client-side exposure
- Graceful fallbacks for all environments
- Developer override capabilities for testing

## Cross-Network Coordination

The authentication system coordinates between different networks:
- Social amplification of blockchain activities
- Coordinated posting between Flow and Lens
- Breathing challenge creation with cross-network rewards

## Security Features

- CSRF protection with secure tokens
- Rate limiting to prevent abuse
- Input validation and sanitization
- Secure session management
- Content Security Policy enforcement
- XSS protection

## Testing

Comprehensive test coverage includes:
- Unit tests for each authentication method
- Integration tests for cross-service operations
- E2E tests for complete user flows
- Security tests for vulnerability assessment