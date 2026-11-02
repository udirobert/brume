async function rpc(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

const __q = new URLSearchParams(location.search);
if (Number.isFinite(+(__q.get("watchdogms") || NaN))) {
  globalThis.__BRUME_BOOT_WATCHDOG_MS = +__q.get("watchdogms");
}

export const AnnaAppRuntime = {
  async connect() {
    const boot = await fetch("/__startup").then((r) => r.json()).catch(() => ({}));
    if (boot.delayMs) await new Promise((r) => setTimeout(r, boot.delayMs));
    if (boot.fail) throw new Error("startup fail injected");
    const listeners = {};
    return {
      window: { set_title: async () => ({ ok: true }) },
      storage: {
        get: (args) => {
          // Test hook: ?poison=hydrate returns a checkpoint that passes
          // validateCheckpoint but throws inside hydrateReset — the field is
          // non-enumerable so JSON.stringify never touches it.
          if (new URLSearchParams(location.search).get("poison") === "hydrate"
              && args?.key === "brume/active-task") {
            const data = { context: "ok" };
            Object.defineProperty(data, "felt", {
              enumerable: false,
              get() { throw new Error("poisoned checkpoint field"); },
            });
            return Promise.resolve({ ok: true, result: { value: {
              version: 1, id: "poison-1", flow: "reset", screen: "input",
              updatedAt: Date.now(), data } } });
          }
          return rpc("/__kv", { op: "get", ...args });
        },
        set: (args) => rpc("/__kv", { op: "set", ...args }),
        list: (args) => rpc("/__kv", { op: "list", ...args }),
      },
      llm: {
        complete: (req) => rpc("/__llm", req),
      },
      audio: { speak: async () => { throw Object.assign(new Error("denied"), { code: "DENIED" }); } },
      mobile: { haptics: async () => {} },
      entryPayload: globalThis.__ENTRY_PAYLOAD__ ?? (await (await fetch("/__entry")).json()).payload ?? null,
      on(event, cb) {
        (listeners[event] ||= []).push(cb);
        globalThis.__pushPayload = (p) => cb(p);
      },
    };
  },
};
