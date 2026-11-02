import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRUME_AVATAR,
  MASCOT_STATES,
  validateAvatar,
  sampleMascot,
} from "../bundle/mascot-engine.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

test("BRUME_AVATAR validates and is deeply frozen", () => {
  const res = validateAvatar(BRUME_AVATAR);
  assert.equal(res.ok, true);
  assert.throws(() => { BRUME_AVATAR.body[0].cx = 1; }, TypeError);
  assert.throws(() => { BRUME_AVATAR.mouths.closed = "x"; }, TypeError);
  assert.equal(MASCOT_STATES.length, 12);
});

test("frames are pure and identical for identical inputs", () => {
  const opts = { state: "idle", presence: "companion", gaze: { x: 1, y: -1 }, breathing: true };
  const a = sampleMascot(12.345, opts);
  const b = sampleMascot(12.345, opts);
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
});

test("all 12 states produce valid, distinct expressions", () => {
  const seen = new Set();
  for (const state of MASCOT_STATES) {
    const f = sampleMascot(3.21, { state });
    assert.equal(f.state, state);
    seen.add(`${f.mouth.d}|${f.eyes.left.ry}|${f.eyes.lidLeft.height}|${f.eyes.left.cy}`);
    for (const v of [f.eyes.left.cx, f.eyes.left.ry, f.body.scale, f.svg.scale]) {
      assert.ok(Number.isFinite(v), `${state}: non-finite value`);
    }
  }
  assert.equal(seen.size, MASCOT_STATES.length - 1);
});

test("unknown state falls back to idle; malformed args clamp or default", () => {
  assert.equal(sampleMascot(1, { state: "nope" }).state, "idle");
  for (const bad of [NaN, Infinity, -Infinity, "x", null]) {
    const f = sampleMascot(bad, { state: "idle" });
    assert.ok(Number.isFinite(f.eyes.left.cx));
  }
  const hi = sampleMascot(0, { state: "idle", breath: 7 });
  const lo = sampleMascot(0, { state: "idle", breath: -2 });
  assert.equal(hi.body.scale, 0.86 + 0.18);
  assert.equal(lo.body.scale, 0.86);
  const g = sampleMascot(0, { state: "idle", gaze: { x: 99, y: -99 } });
  assert.ok(Math.abs(g.gaze.x) <= 2.4 && Math.abs(g.gaze.y) <= 1.8);
  const nanGaze = sampleMascot(0, { state: "idle", gaze: { x: NaN } });
  assert.ok(Number.isFinite(nanGaze.eyes.left.cx));
});

test("deterministic blink closes and reopens on the fixed schedule", () => {
  const open = (t) => sampleMascot(t, { state: "idle" }).eyes.left.ry;
  assert.ok(open(4.8) < 1, "closed at 4.8");
  assert.ok(open(4.8 + 20) < 1, "closed a cycle later");
  assert.equal(open(3.0), 4, "open between blinks");
  assert.equal(open(4.8), open(24.8), "same phase same frame");
  assert.equal(sampleMascot(4.8, { state: "hold" }).eyes.left.ry, 4 * 0.12);
});

test("gaze shifts eyes and lids, mouth follows at 35%", () => {
  const f = sampleMascot(0, { state: "watching", gaze: { x: 2, y: 1 } });
  assert.equal(f.eyes.left.cx, 41 + 2);
  assert.equal(f.eyes.lidLeft.x, 41 + 2 - 4);
  assert.ok(Math.abs(f.mouth.dx - 0.7) < 1e-9);
});

test("sleepy slit fade only for companion idle after 120s", () => {
  const base = sampleMascot(0, { state: "idle", presence: "companion", idleSeconds: 0 });
  const later = sampleMascot(0, { state: "idle", presence: "companion", idleSeconds: 180 });
  assert.ok(later.eyes.left.ry < base.eyes.left.ry * 0.5);
  const quiet = sampleMascot(0, { state: "idle", presence: "quiet", idleSeconds: 999 });
  assert.equal(quiet.eyes.left.ry, base.eyes.left.ry);
  const session = sampleMascot(0, { state: "exhale", presence: "companion", idleSeconds: 999 });
  assert.ok(session.eyes.left.ry > later.eyes.left.ry);
});

test("explicit breath wins over auto breathing", () => {
  const t = 1.75;
  const f = sampleMascot(t, { state: "idle", breathing: true, breath: 1 });
  assert.equal(f.body.scale, 0.86 + 0.18);
  const auto = sampleMascot(0, { state: "idle", breathing: true });
  const auto2 = sampleMascot(t, { state: "idle", breathing: true });
  assert.ok(Math.abs(auto.body.scale - auto2.body.scale) > 0.01);
});

test("companion motion vs quiet stillness for accessories", () => {
  const c = sampleMascot(1.75, { state: "stretch", presence: "companion" });
  assert.ok(c.accessories.halo.opacity > 0.55);
  const q = sampleMascot(1.75, { state: "stretch", presence: "quiet" });
  assert.deepEqual(q.accessories.halo, { opacity: 1, scale: 1 });
  const ex = sampleMascot(0.5, { state: "exhale", presence: "quiet" });
  assert.ok(ex.accessories.wisps[0].opacity > 0);
});

test("topup puff fires once after state entry then settles", () => {
  assert.equal(sampleMascot(10, { state: "topup", stateAge: 0.25 }).svg.scale > 1, true);
  assert.equal(sampleMascot(10, { state: "topup", stateAge: 5 }).svg.scale, 1);
});

test("reduced motion is a static expression for every state", () => {
  for (const state of MASCOT_STATES) {
    const a = sampleMascot(1, { state, reducedMotion: true });
    const b = sampleMascot(999, {
      state, reducedMotion: true,
      gaze: { x: 9, y: 9 }, idleSeconds: 500, breath: 0.9, breathing: true,
    });
    assert.deepEqual(a, b, `${state} moved under reduced motion`);
    assert.equal(a.svg.scale, 1);
    assert.equal(a.body.scale, 1);
    assert.equal(a.breath, null);
    if (state === "proud") assert.equal(a.mouth.d, BRUME_AVATAR.mouths.smile);
  }
});

test("validator rejects malformed input safely", () => {
  const bad = [
    null, undefined, 42, "x", [], NaN,
    { version: 2 },
    { version: 1, body: [], highlight: {}, eyes: {}, mouths: {}, extra: 1 },
    { version: 1, body: [{ type: "rect", cx: 1, cy: 1 }], highlight: {}, eyes: {}, mouths: {} },
  ];
  for (const v of bad) {
    const res = validateAvatar(v);
    assert.equal(res.ok, false, JSON.stringify(v));
    assert.ok(Array.isArray(res.errors) && res.errors.length > 0);
  }
});

test("validator rejects type-mismatched keys and out-of-box geometry", () => {
  const a = clone(BRUME_AVATAR);
  a.body[0].bogus = 1;
  assert.equal(validateAvatar(a).ok, false);
  const b = clone(BRUME_AVATAR);
  b.body[0].cx = NaN;
  assert.equal(validateAvatar(b).ok, false);
  const c = clone(BRUME_AVATAR);
  c.body[0].cx = 95;
  assert.equal(validateAvatar(c).ok, false);
  const d = clone(BRUME_AVATAR);
  d.body[0].r = -3;
  assert.equal(validateAvatar(d).ok, false);
  const e = clone(BRUME_AVATAR);
  e.eyes.leftX = 95;
  assert.equal(validateAvatar(e).ok, false);
  const f = clone(BRUME_AVATAR);
  f.body[0].r = 4;
  assert.equal(validateAvatar(f).ok, false);
  const g = clone(BRUME_AVATAR);
  g.body[1].rx = 4;
  assert.equal(validateAvatar(g).ok, false);
  const h = clone(BRUME_AVATAR);
  h.body[2].cy = 10;
  assert.equal(validateAvatar(h).ok, false);
  const many = clone(BRUME_AVATAR);
  many.body = Array.from({ length: 33 }, () => ({ type: "circle", cx: 50, cy: 50, r: 5 }));
  assert.equal(validateAvatar(many).ok, false);
  const circleHl = clone(BRUME_AVATAR);
  circleHl.highlight = { type: "circle", cx: 56, cy: 30, r: 8 };
  assert.equal(validateAvatar(circleHl).ok, true);
});

test("validator rejects mouth markup, URLs, arities and bad numbers", () => {
  for (const d of [
    "<script>alert(1)</script>",
    "M 0 0 url(http://x)",
    "M 0 0; drop table",
    "M".repeat(600),
    "",
    "M M M",
    "L 10 10",
    "M 1e999 0",
    "M 1e 0",
    "M 10",
    "M 10 10 Q 1 2 3",
    "M 10 10 Q 1 2 3 4 junk",
    "M 10 10 Z 5",
    "M 10 10 C 1 2 3 4 5",
  ]) {
    const a = clone(BRUME_AVATAR);
    a.mouths.closed = d;
    assert.equal(validateAvatar(a).ok, false, d.slice(0, 30));
  }
  for (const d of [
    "M 45 61 L 55 61",
    "m 10 10 l 5 5",
    "M 10 10 C 1 2 3 4 5 6 Z",
    "M 10 10 Q 1 2 3 4 Q 5 6 7 8",
    "M 10 10 H 20 V 30 Z",
    "M 10 10 20 20",
  ]) {
    const a = clone(BRUME_AVATAR);
    a.mouths.closed = d;
    assert.equal(validateAvatar(a).ok, true, d);
  }
});

test("validateAvatar never mutates its input", () => {
  const a = clone(BRUME_AVATAR);
  a.body[0].bogus = 1;
  const before = JSON.stringify(a);
  validateAvatar(a);
  assert.equal(JSON.stringify(a), before);
});

test("sampleMascot does not mutate options or the avatar", () => {
  const opts = { state: "idle", gaze: { x: 1, y: 2 }, presence: "companion" };
  const before = JSON.stringify({ opts, avatar: BRUME_AVATAR });
  sampleMascot(5, opts);
  assert.equal(JSON.stringify({ opts, avatar: BRUME_AVATAR }), before);
});
