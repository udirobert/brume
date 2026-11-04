/**
 * Brume asks for no wallet, keeps nothing on a chain and sells no tier.
 *
 * The privacy page is allowed to say so in prose; this checks that no code
 * path still means the opposite. Prose is easy to leave behind — the page
 * described credential attestations for months after nothing issued one — so
 * the absence is asserted against imports and routes rather than copy.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Chains, wallets and the paywall screens that used to hang off them. */
const FORBIDDEN = [
  "@onflow/fcl",
  "wagmi",
  "viem",
  "services/blockchain",
  "lib/lens",
  "lib/flow",
  "lib/wallet",
  "lib/wagmi",
  "EagerWeb3Provider",
  "Web3AuthIsland",
  "useBlockchainAuth",
  "useAttestation",
  "useLens",
  "useFlow",
  "useWallet",
  "useSiweAuth",
  "SubscriptionManager",
  "useSubscriptionAccess",
  "useSecureAIAnalysis",
  "AuthMethodCard",
  "UnifiedAuthFlow",
  "types/blockchain",
];

const GONE = [
  "src/services/blockchain",
  "src/lib/lens",
  "src/lib/flow",
  "src/lib/wallet",
  "src/lib/wagmi",
  "src/providers/EagerWeb3Provider.tsx",
  "src/components/auth/Web3AuthIsland.tsx",
  "src/components/auth/AuthMethodCard.tsx",
  "src/components/auth/UnifiedAuthFlow.tsx",
  "src/components/WalletManager.tsx",
  "src/components/wallet",
  "src/components/monetization",
  "src/pages/Subscription.tsx",
  "src/types/fcl.d.ts",
  "src/types/blockchain.ts",
  "src/types/auth.ts",
  "src/config/messaging.ts",
  "src/hooks/useAuthPreferences.ts",
  "src/hooks/useAuthPerformance.ts",
];

describe("no wallet, no chain, no paywall", () => {
  const files = walk("src");

  it("no source file imports them", () => {
    const hits = files.filter((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => /(?:^|[\s(=])import[\s(*]/.test(line) || /^\s*export .*from/.test(line))
        .some((line) => FORBIDDEN.some((needle) => line.includes(needle))),
    );
    expect(hits).toEqual([]);
  });

  it("the modules are gone, not merely unreferenced", () => {
    for (const path of GONE) expect(existsSync(path), path).toBe(false);
  });

  it("no route sells a subscription", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).not.toMatch(/\/subscription/);
    expect(app).not.toMatch(/Web3Route/);
  });

  it("sign-in asks for an email and nothing else", () => {
    for (const path of ["src/components/auth/SignInForm.tsx", "src/pages/Auth.tsx"]) {
      expect(readFileSync(path, "utf8"), path).not.toMatch(/wallet/i);
    }
  });

  it("the session store holds a session, not a wallet", () => {
    // Prose in this file is allowed to name what used to be here; the state
    // shape is what a screen can read, so that is what must be clean.
    const state = readFileSync("src/stores/authStore.ts", "utf8").match(
      /const initialState: AuthSession = \{[\s\S]*?\n\};/,
    )?.[0];
    expect(state).toBeDefined();
    for (const needle of ["wallet", "lens", "siwe", "revenueCat", "tier"]) {
      expect(state, needle).not.toMatch(new RegExp(needle, "i"));
    }
  });

  it("profile offers no tier and no premium", () => {
    const profile = readFileSync("src/pages/UserProfile.tsx", "utf8");
    expect(profile).not.toMatch(/Premium|tierLabel|badge-premium/i);
  });

  it("the auth hook has no wallet or chain surface left", () => {
    const hook = readFileSync("src/hooks/useAuth.ts", "utf8");
    for (const needle of ["loginWithWallet", "connectWallet", "hasWallet", "walletUser", "siwe", "blockchainAuth"]) {
      expect(hook, needle).not.toMatch(new RegExp(needle, "i"));
    }
  });
});
