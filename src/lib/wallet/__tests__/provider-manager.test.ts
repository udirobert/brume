/**
 * provider-manager — EIP-1193 request dispatch must keep the provider as
 * receiver. Regression test for the extracted-request binding bug.
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

interface FakeEthereum {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
}

let fakeEthereum: FakeEthereum;
let wrongReceiver = false;
let receivedArgs: { method: string; params?: unknown[] } | null = null;
const rejectError = new Error("provider rejected");
let rejectNext = false;

async function freshManager() {
  vi.resetModules();
  const mod = await import("../provider-manager");
  return mod.walletProviderManager as {
    initialize: () => Promise<void>;
    switchProvider: (name: string) => Promise<void>;
    request: (method: string, params?: unknown[]) => Promise<unknown>;
    destroy: () => void;
  };
}

describe("WalletProviderManager direct-ethereum request", () => {
  beforeEach(() => {
    wrongReceiver = false;
    receivedArgs = null;
    rejectNext = false;
    fakeEthereum = {
      request(args) {
        if (this !== fakeEthereum) {
          wrongReceiver = true;
          return Promise.reject(new Error("receiver lost"));
        }
        receivedArgs = args;
        if (rejectNext) return Promise.reject(rejectError);
        if (args.method === "eth_accounts") return Promise.resolve(["0xabc"]);
        return Promise.resolve({ ok: true });
      },
      on: () => {},
      removeListener: () => {},
    };
    Object.defineProperty(window, "ethereum", {
      value: fakeEthereum,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "ethereum");
  });

  it("invokes request with the provider as receiver", async () => {
    const manager = await freshManager();
    try {
      await manager.initialize();
      await manager.switchProvider("direct-ethereum");

      const result = await manager.request("eth_sendTest", [1, "two"]);
      expect(wrongReceiver).toBe(false);
      expect(receivedArgs).toEqual({ method: "eth_sendTest", params: [1, "two"] });
      expect(result).toEqual({ ok: true });
    } finally {
      manager.destroy();
    }
  });

  it("preserves rejected error identity", async () => {
    const manager = await freshManager();
    try {
      await manager.initialize();
      await manager.switchProvider("direct-ethereum");

      rejectNext = true;
      await expect(manager.request("eth_fail")).rejects.toBe(rejectError);
      expect(wrongReceiver).toBe(false);
    } finally {
      manager.destroy();
    }
  });
});
