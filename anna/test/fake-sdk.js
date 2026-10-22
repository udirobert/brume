async function rpc(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json();
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
        get: (args) => rpc("/__kv", { op: "get", ...args }),
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
