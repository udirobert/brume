import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { WIDGET_HTML } from "../widget.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeWidget(toolOutput, { reduced = false } = {}) {
  const pendingRaf = new Set();
  const pendingTimers = new Set();
  const mqlListeners = new Set();
  const mql = {
    matches: reduced,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_t, f) => mqlListeners.add(f),
    removeEventListener: (_t, f) => mqlListeners.delete(f),
    addListener: (f) => mqlListeners.add(f),
    removeListener: (f) => mqlListeners.delete(f),
    dispatch(m) {
      mql.matches = m;
      mqlListeners.forEach((f) => f({ matches: m }));
    },
  };
  const dom = new JSDOM(WIDGET_HTML, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w) {
      w.openai = { toolOutput };
      w.matchMedia = () => mql;
      const raf = w.requestAnimationFrame.bind(w);
      const caf = w.cancelAnimationFrame.bind(w);
      w.requestAnimationFrame = (cb) => {
        let id;
        id = raf(() => { pendingRaf.delete(id); cb(); });
        pendingRaf.add(id);
        return id;
      };
      w.cancelAnimationFrame = (id) => { pendingRaf.delete(id); caf(id); };
      const sto = w.setTimeout.bind(w);
      const cto = w.clearTimeout.bind(w);
      w.setTimeout = (cb, ms, ...rest) => {
        let id;
        id = sto(() => { pendingTimers.delete(id); cb(); }, ms, ...rest);
        pendingTimers.add(id);
        return id;
      };
      w.clearTimeout = (id) => { pendingTimers.delete(id); cto(id); };
    },
  });
  return { dom, pendingRaf, pendingTimers, mql };
}

const PLAN = {
  phases: [
    { word: "Breathe in", seconds: 0.06 },
    { word: "Hold", seconds: 0.06 },
    { word: "Breathe out", seconds: 0.08 },
  ],
  cycles: 1,
  title: "A square breath",
  cues: ["Notice your feet on the floor"],
};

test("widget script executes: phases drive mascot states and completion", async () => {
  const { dom, pendingRaf } = makeWidget(PLAN);
  const doc = dom.window.document;
  await sleep(60);
  assert.equal(doc.querySelectorAll("svg.mascot-svg").length, 1);
  assert.equal(doc.getElementById("title").textContent, "A square breath");
  const state = doc.querySelector("[data-state]").dataset.state;
  assert.ok(["inhale", "hold", "exhale", "proud"].includes(state), state);
  assert.equal(pendingRaf.size, 1);
  await sleep(400);
  assert.equal(doc.getElementById("phase").textContent, "Done");
  assert.equal(doc.querySelector("[data-state]").dataset.state, "proud");
  assert.equal(doc.getElementById("again").style.display, "block");
  assert.equal(pendingRaf.size, 1);
  dom.window.close();
});

test("double-clicking Again keeps a single driver, single timer, single svg", async () => {
  const { dom, pendingRaf, pendingTimers } = makeWidget(PLAN);
  const doc = dom.window.document;
  await sleep(500);
  assert.equal(doc.getElementById("phase").textContent, "Done");
  const again = doc.getElementById("again");
  again.click();
  again.click();
  again.click();
  await sleep(40);
  assert.equal(pendingRaf.size, 1);
  assert.equal(pendingTimers.size, 1);
  assert.equal(doc.querySelectorAll("svg.mascot-svg").length, 1);
  await sleep(400);
  assert.equal(doc.getElementById("phase").textContent, "Done");
  assert.equal(doc.querySelectorAll("svg.mascot-svg").length, 1);
  dom.window.close();
});

test("reduced motion suppresses the breath driver and resumes when it lifts", async () => {
  const { dom, pendingRaf, mql } = makeWidget(
    { ...PLAN, phases: [{ word: "Breathe in", seconds: 30 }] },
    { reduced: true },
  );
  const doc = dom.window.document;
  await sleep(60);
  assert.equal(doc.querySelector("[data-state]").dataset.state, "inhale");
  assert.equal(pendingRaf.size, 0);
  mql.dispatch(false);
  await sleep(60);
  assert.equal(pendingRaf.size, 1);
  dom.window.close();
});

test("pagehide cancels pending timers, RAF and removes listeners cleanly", async () => {
  const { dom, pendingRaf, pendingTimers } = makeWidget({
    ...PLAN,
    phases: [{ word: "Breathe in", seconds: 30 }],
  });
  const doc = dom.window.document;
  await sleep(60);
  assert.equal(doc.querySelectorAll("svg.mascot-svg").length, 1);
  assert.equal(pendingRaf.size, 1);
  assert.equal(pendingTimers.size, 1);
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  await sleep(60);
  assert.equal(pendingRaf.size, 0);
  assert.equal(pendingTimers.size, 0);
  assert.equal(doc.querySelectorAll("svg.mascot-svg").length, 0);
  assert.notEqual(doc.getElementById("phase").textContent, "Done");
  dom.window.close();
});
