import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const arrive = await import(join(here, "..", "bundle", "arrive.js"));
const {
  FEELINGS, ACTS, feelingById, actFor,
  buildInvitePrompt, cleanInvite, inviteFallback, INVITE_FALLBACK,
  INVITE_MAX_WORDS,
} = arrive;

test("feelings: closed set, unique ids, valid acts", () => {
  const ids = new Set();
  for (const f of FEELINGS) {
    assert.ok(!ids.has(f.id), `dup ${f.id}`);
    ids.add(f.id);
    assert.ok(f.label && f.label.length <= 12);
    assert.ok(f.act === null || ACTS[f.act], `${f.id} -> ${f.act}`);
  }
});

test("every feeling has a fallback invite", () => {
  for (const f of FEELINGS) {
    assert.ok(INVITE_FALLBACK[f.id], `missing fallback ${f.id}`);
    assert.equal(inviteFallback(f.id), INVITE_FALLBACK[f.id]);
  }
  assert.ok(inviteFallback("nope"));
});

test("actFor maps feelings to acts", () => {
  assert.equal(actFor("wired"), "scatter");
  assert.equal(actFor("overwhelmed"), "scatter");
  assert.equal(actFor("heavy"), "setdown");
  assert.equal(actFor("stuck"), "setdown");
  assert.equal(actFor("okay"), null);
  assert.equal(actFor("bogus"), null);
  assert.equal(feelingById("wired").label, "Wired");
  assert.equal(feelingById("bogus"), null);
});

test("invite prompt carries feeling + act, rejects unknown", () => {
  const p = buildInvitePrompt({ feeling: "wired", act: "scatter" });
  assert.match(p, /Wired/);
  assert.match(p, /Scatter/);
  assert.match(p, /never interpret/i);
  const calm = buildInvitePrompt({ feeling: "okay", act: null });
  assert.match(calm, /Okay/);
  assert.equal(buildInvitePrompt({ feeling: "bogus" }), "");
});

test("cleanInvite keeps good lines, strips wrapping", () => {
  assert.equal(cleanInvite('"Draw it and let it go."', "wired"), "Draw it and let it go.");
  assert.equal(cleanInvite("  Set it down, slowly.  ", "heavy"), "Set it down, slowly.");
});

test("cleanInvite rejects unusable model output", () => {
  for (const bad of [
    "",
    "   ",
    null,
    42,
    "x".repeat(200),
    "This will help you calm down.",
    "Drawing reduces anxiety effectively.",
    "I promise this works because of the practice.",
    "Wired? Draw it and let it go.", // echoes the catalog word
    "word ".repeat(40),
  ]) {
    assert.equal(cleanInvite(bad, "wired"), null, JSON.stringify(bad).slice(0, 60));
  }
});

test("cleanInvite tolerates emoji and control chars", () => {
  assert.equal(cleanInvite("Draw it ✨ and let it go.", "wired"), "Draw it and let it go.");
});

// --- Copy -------------------------------------------------------------------

test("fallback invites never echo a catalog word and pass their own cleaner", () => {
  const labels = FEELINGS.map((f) => f.label);
  for (const f of FEELINGS) {
    const line = INVITE_FALLBACK[f.id];
    for (const label of labels) {
      assert.doesNotMatch(line, new RegExp(`\\b${label}\\b`, "i"), `${f.id}: "${line}" echoes ${label}`);
    }
    assert.equal(cleanInvite(line, f.id), line, `${f.id} fallback rejected by cleanInvite`);
  }
  assert.ok(ACTS.setdown.slip && !/\b(heavy|stuck)\b/i.test(ACTS.setdown.slip));
});

// --- Scatter core -----------------------------------------------------------

const { SCATTER, inkWidth, releaseAt, inkAlpha, mistAlpha, mistRadius, dissolveSeconds, planMist, stepMist, seededRandom } = arrive;

test("scatter: ink thins as the hand speeds up, within bounds", () => {
  let prev = null;
  for (const speed of [0, 0.2, 0.5, 1, 1.4, 5]) {
    const w = inkWidth(speed);
    assert.ok(w >= SCATTER.MIN_WIDTH && w <= SCATTER.MAX_WIDTH, `width ${w}`);
    if (prev !== null) assert.ok(w <= prev, "faster must not be thicker");
    prev = w;
  }
  assert.equal(inkWidth(0), SCATTER.MAX_WIDTH);
  assert.equal(inkWidth(99), SCATTER.MIN_WIDTH);
  // Smoothed: one fast sample can't snap a slow stroke to hairline.
  assert.ok(inkWidth(99, SCATTER.MAX_WIDTH) > SCATTER.MIN_WIDTH + 2);
});

test("scatter: erosion rises from the bottom, inside the release window", () => {
  const h = 300;
  let lowerFirst = 0;
  for (let x = 0; x <= 400; x += 10) {
    for (let y = 0; y <= h; y += 15) {
      const r = releaseAt(x, y, h, 1.3);
      assert.ok(r >= SCATTER.LIFT_S && r <= SCATTER.LIFT_S + SCATTER.ERODE_S, `r=${r}`);
    }
    if (releaseAt(x, h * 0.95, h, 1.3) < releaseAt(x, h * 0.05, h, 1.3)) lowerFirst += 1;
  }
  assert.equal(lowerFirst, 41, "bottom ink must always release before top ink");
});

test("scatter: ink feathers out before release, never a hard cut", () => {
  assert.equal(inkAlpha(0, 1), 1);
  assert.equal(inkAlpha(1, 1), 0);
  const mid = inkAlpha(1 - SCATTER.EDGE_S / 2, 1);
  assert.ok(mid > 0.3 && mid < 0.6, `mid feather ${mid}`);
  assert.ok(inkAlpha(SCATTER.LIFT_S, 5) < 1, "the page lightens as it lifts");
});

test("scatter: mist fades in, swells and is gone at end of life", () => {
  assert.equal(mistAlpha(0), 0);
  assert.equal(mistAlpha(1), 0);
  for (let a = 0; a <= 1; a += 0.05) assert.ok(mistAlpha(a) <= SCATTER.PEAK_ALPHA + 1e-9);
  assert.ok(mistAlpha(0.16) > 0.3);
  let r0 = 0;
  for (let a = 0; a <= 1; a += 0.1) {
    const r = mistRadius(4, a);
    assert.ok(r > r0, "mist only grows");
    r0 = r;
  }
  assert.ok(mistRadius(4, 1) > 4 * 4, "mist ends several times the ink width");
});

test("scatter: the whole dissolve stays under four seconds", () => {
  assert.ok(dissolveSeconds() < 4, `${dissolveSeconds()}s`);
});

test("scatter: particle budget holds on a page full of ink, and mist rises", () => {
  const points = Array.from({ length: 6000 }, (_, i) => ({ x: i % 300, y: (i * 7) % 280, w: 5 }));
  const mist = planMist([{ points }], 280, seededRandom(4), 0.5);
  assert.ok(mist.length <= SCATTER.MAX_PARTICLES + SCATTER.PER_POINT, `${mist.length} particles`);
  assert.ok(mist.length > SCATTER.MAX_PARTICLES * 0.8);
  const small = planMist([{ points: points.slice(0, 50) }], 280, seededRandom(4), 0.5);
  assert.equal(small.length, 50 * SCATTER.PER_POINT, "a small drawing keeps every point");
  const p = { ...small[0] };
  const y0 = p.y;
  for (let t = p.born; t < p.born + p.life; t += 1 / 60) stepMist(p, t, 1 / 60);
  assert.ok(p.y < y0 - 30, `mist must rise (moved ${y0 - p.y}px)`);
});

test("scatter: the same seed breaks up the same way", () => {
  const pts = [{ points: [{ x: 10, y: 20, w: 4 }, { x: 30, y: 50, w: 5 }] }];
  assert.deepEqual(planMist(pts, 200, seededRandom(9), 1), planMist(pts, 200, seededRandom(9), 1));
});

// --- Set it down core -------------------------------------------------------

const { SETDOWN, setdownStart, stepSetdown } = arrive;
const DROP = 162;
const DT = 1 / 60;

// Pull with a finger moving at `speed` px/s; returns what happened.
function pull(speed, { releaseAtY = Infinity, seconds = 8, keyboard = false } = {}) {
  let s = setdownStart();
  let finger = 0;
  let gripped = true;
  let maxV = 0;
  let slipped = false;
  let landedAt = null;
  let prevDy = Infinity;
  let decelerating = true;
  for (let t = 0; t < seconds; t += DT) {
    finger += speed * DT;
    if (s.y >= releaseAtY) gripped = false;
    const targetY = keyboard ? s.y + SETDOWN.SLIP_GAP * 0.5 : finger;
    const y0 = s.y;
    const r = stepSetdown(s, { gripped, targetY }, DT, DROP);
    s = r.state;
    maxV = Math.max(maxV, (s.y - y0) / DT);
    if (s.phase === "landing" || r.landed) {
      const dy = s.y - y0;
      if (dy > prevDy + 1e-9) decelerating = false;
      prevDy = dy;
    }
    if (r.slipped) { slipped = true; gripped = false; }
    if (r.landed) { landedAt = t; break; }
  }
  return { s, maxV, slipped, landedAt, decelerating };
}

test("set down: a flick slips and never lands", () => {
  for (const speed of [400, 900, 3000]) {
    const r = pull(speed, { seconds: 3 });
    assert.equal(r.slipped, true, `${speed}px/s should slip`);
    assert.equal(r.landedAt, null);
    assert.equal(r.s.phase, "ready");
    assert.ok(r.s.y < 1, "it floats back once the grip slips");
  }
});

test("set down: a slow pull lands, and never faster than the weight allows", () => {
  for (const speed of [40, 60, 80, 100]) {
    const r = pull(speed);
    assert.equal(r.slipped, false, `${speed}px/s should not slip`);
    assert.notEqual(r.landedAt, null, `${speed}px/s should land`);
    assert.ok(r.landedAt >= (DROP * SETDOWN.LAND_AT) / SETDOWN.MAX_SPEED, `landed at ${r.landedAt}s`);
    assert.ok(r.maxV <= SETDOWN.MAX_SPEED + 1e-6, `max speed ${r.maxV}`);
    assert.equal(r.s.phase, "done");
    assert.equal(r.s.y, DROP);
  }
});

test("set down: the landing decelerates — set down, not dropped", () => {
  assert.equal(pull(70).decelerating, true);
});

test("set down: letting go early floats it back; past the landing line it lands anyway", () => {
  const early = pull(70, { releaseAtY: DROP * 0.5, seconds: 5 });
  assert.equal(early.landedAt, null);
  assert.equal(early.s.y, 0);
  assert.equal(early.s.phase, "ready");
  const late = pull(70, { releaseAtY: DROP * SETDOWN.LAND_AT });
  assert.notEqual(late.landedAt, null);
});

test("set down: holding the key lowers it at the same unhurried pace", () => {
  const r = pull(0, { keyboard: true });
  assert.equal(r.slipped, false);
  assert.notEqual(r.landedAt, null);
  assert.ok(r.landedAt >= (DROP * SETDOWN.LAND_AT) / SETDOWN.MAX_SPEED);
  assert.ok(r.maxV <= SETDOWN.MAX_SPEED + 1e-6);
});

test("set down: done is terminal and bad input is inert", () => {
  const done = { y: DROP, v: 0, phase: "done" };
  assert.deepEqual(stepSetdown(done, { gripped: true, targetY: 0 }, DT, DROP).state, done);
  const s = setdownStart();
  assert.deepEqual(stepSetdown(s, { gripped: true, targetY: 50 }, DT, 0).state, s);
  const huge = stepSetdown(s, { gripped: true, targetY: 20 }, 10, DROP).state;
  assert.ok(huge.y <= SETDOWN.MAX_SPEED * 0.05 + 1e-6, "a stalled frame can't teleport the weight");
});

test("scatter: mist thins out before the page edge", () => {
  const { edgeFade } = arrive;
  assert.equal(edgeFade(150, 200, 300), 1);
  assert.equal(edgeFade(150, 0, 300), 0);
  assert.equal(edgeFade(150, -10, 300), 0);
  assert.equal(edgeFade(0, 200, 300), 0);
  assert.equal(edgeFade(300, 200, 300), 0);
  assert.ok(edgeFade(150, 18, 300) > 0.4 && edgeFade(150, 18, 300) < 0.6);
});
