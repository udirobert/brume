import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRUME_AVATAR,
  MASCOT_STATES,
  MASCOT_REACTIONS,
  validateAvatar,
  sampleMascot,
  blendPath,
  breathAmount,
} from "../bundle/mascot-engine.js";

const clone = (v) => JSON.parse(JSON.stringify(v));

test("BRUME_AVATAR validates and is deeply frozen", () => {
  const res = validateAvatar(BRUME_AVATAR);
  assert.equal(res.ok, true);
  assert.throws(() => { BRUME_AVATAR.body[0].cx = 1; }, TypeError);
  assert.throws(() => { BRUME_AVATAR.mouths.closed = "x"; }, TypeError);
  assert.equal(MASCOT_STATES.length, 13);
});

test("frames are pure and identical for identical inputs", () => {
  const opts = { state: "idle", presence: "companion", gaze: { x: 1, y: -1 }, breathing: true };
  const a = sampleMascot(12.345, opts);
  const b = sampleMascot(12.345, opts);
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
});

test("all 13 states produce valid, distinct expressions", () => {
  const seen = new Set();
  for (const state of MASCOT_STATES) {
    const f = sampleMascot(3.21, { state });
    assert.equal(f.state, state);
    seen.add(`${f.mouth.d}|${f.eyes.left.ry}|${f.eyes.lidLeft.height}|${f.eyes.left.cy}`);
    for (const v of [f.eyes.left.cx, f.eyes.left.ry, f.body.scale, f.root.sx]) {
      assert.ok(Number.isFinite(v), `${state}: non-finite value`);
    }
  }
  assert.equal(seen.size, MASCOT_STATES.length);
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

test("blink runs in session states but not hold or sleepy", () => {
  for (const state of ["inhale", "exhale", "watching"]) {
    const open = sampleMascot(4.8, { state }).eyes.left.ry;
    const rested = sampleMascot(3.0, { state }).eyes.left.ry;
    assert.ok(open < rested, `${state} should blink`);
  }
  for (const state of ["hold", "sleepy"]) {
    const at = sampleMascot(4.8, { state }).eyes.left.ry;
    const between = sampleMascot(3.0, { state }).eyes.left.ry;
    assert.equal(at, between, `${state} should not blink`);
  }
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
  assert.equal(sampleMascot(10, { state: "topup", stateAge: 0.25 }).root.sx > 1, true);
  assert.equal(sampleMascot(10, { state: "topup", stateAge: 5 }).root.sx, 1);
});

test("idle bob moves the root group unless reduced", () => {
  const ys = [0.4, 1.7, 3.1, 4.9].map((t) => sampleMascot(t, { state: "idle" }).root.y);
  assert.ok(new Set(ys.map((y) => y.toFixed(6))).size > 1, "bob should vary over t");
  assert.ok(ys.every((y) => y <= 0), "bob dips, never rises");
  const still = sampleMascot(2.6, { state: "idle", reducedMotion: true });
  assert.deepEqual(
    { y: still.root.y, rotate: still.root.rotate, sx: still.root.sx, sy: still.root.sy },
    { y: 0, rotate: 0, sx: 1, sy: 1 },
  );
});

test("reduced motion is a static expression for every state", () => {
  for (const state of MASCOT_STATES) {
    const a = sampleMascot(1, { state, reducedMotion: true });
    const b = sampleMascot(999, {
      state, reducedMotion: true,
      gaze: { x: 9, y: 9 }, idleSeconds: 500, breath: 0.9, breathing: true,
    });
    assert.deepEqual(a, b, `${state} moved under reduced motion`);
    assert.equal(a.root.sx, 1);
    assert.equal(a.root.y, 0);
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

test("transitions blend from a frozen pose over 0.5s", () => {
  const t = 3.0;
  const idlePose = sampleMascot(t, { state: "idle" }).pose;
  const atStart = sampleMascot(t, { state: "proud", from: idlePose, stateAge: 0 });
  assert.deepEqual(atStart.pose, idlePose);
  const target = sampleMascot(t, { state: "proud" });
  const atEnd = sampleMascot(t, { state: "proud", from: idlePose, stateAge: 0.5 });
  assert.deepEqual(atEnd.pose, target.pose);
  const mid = sampleMascot(t, { state: "proud", from: idlePose, stateAge: 0.25 });
  assert.ok(mid.pose.open > target.pose.open && mid.pose.open < idlePose.open);
  assert.notEqual(mid.pose.mouth, idlePose.mouth);
  assert.notEqual(mid.pose.mouth, target.pose.mouth);
  const noFrom = sampleMascot(t, { state: "proud", stateAge: 0 });
  assert.deepEqual(noFrom.pose, target.pose);
});

test("blendPath lerps matching structures and swaps mismatched at 0.5", () => {
  assert.equal(blendPath("M 0 0 L 10 10", "M 0 0 L 20 30", 0.5), "M 0 0 L 15 20");
  const a = "M 0 0 L 1 1";
  const b = "M 0 0 Q 1 1 2 2 Z";
  assert.equal(blendPath(a, b, 0.4), a);
  assert.equal(blendPath(a, b, 0.6), b);
});

test("all four default mouths share one structure so they morph", () => {
  const mouths = Object.values(BRUME_AVATAR.mouths);
  for (const a of mouths) {
    for (const b of mouths) {
      if (a === b) continue;
      const mid = blendPath(a, b, 0.5);
      assert.notEqual(mid, a);
      assert.notEqual(mid, b);
    }
  }
});

test("reactions are one-shots layered on the frame", () => {
  assert.deepEqual(MASCOT_REACTIONS, ["hop", "settle", "celebrate", "ready"]);
  const t = 3.0;
  const base = sampleMascot(t, { state: "idle" });
  const hop = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: 0.25 } });
  assert.ok(hop.root.y < base.root.y, "hop lifts the root");
  const over = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: 0.5 } });
  assert.deepEqual(over, base);
  const unknown = sampleMascot(t, { state: "idle", reaction: { name: "wiggle", age: 0.1 } });
  assert.deepEqual(unknown, base);
  const reduced = sampleMascot(t, {
    state: "idle", reducedMotion: true, reaction: { name: "hop", age: 0.25 },
  });
  assert.deepEqual(reduced, sampleMascot(t, { state: "idle", reducedMotion: true }));
  const cheer = sampleMascot(t, { state: "idle", reaction: { name: "celebrate", age: 0.45 } });
  assert.equal(cheer.mouth.d, BRUME_AVATAR.mouths.smile);
  assert.ok(cheer.root.y < base.root.y);
});

test("breathAmount maps phase progress to the eased 0..1 curve", () => {
  assert.equal(breathAmount("inhale", 0), 0);
  assert.equal(breathAmount("inhale", 1), 1);
  assert.ok(Math.abs(breathAmount("inhale", 0.5) - 0.5) < 1e-9);
  assert.equal(breathAmount("topup", 0.4), 1);
  assert.equal(breathAmount("hold", 0.4), 1);
  assert.equal(breathAmount("exhale", 0), 1);
  assert.equal(breathAmount("exhale", 1), 0);
  assert.equal(breathAmount("pause", 0.5), 0);
  assert.equal(breathAmount("whatever", 0.5), 0);
  assert.equal(breathAmount("inhale", NaN), 0);
  assert.equal(breathAmount("inhale", 7), 1);
});

test("reactions are three-act: crouch, apex, touchdown squash", () => {
  const t = 3.0;
  const base = sampleMascot(t, { state: "idle" });
  // act one — anticipation: weight gathers, body compresses downward
  const crouch = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: 0.05 } });
  assert.ok(crouch.root.y > base.root.y, "hop crouches (dips) before launch");
  assert.ok(crouch.root.sy < base.root.sy, "crouch compresses");
  // act two — apex stretch
  const apex = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: 0.2 } });
  assert.ok(apex.root.y < base.root.y, "hop is airborne");
  assert.ok(apex.root.sy > base.root.sy, "apex stretches");
  // act three — the fall ends exactly on rest at renormalised p 0.86
  // (raw age 0.97 · 0.86 · 0.5), then the touchdown squash peaks.
  const landedAt = 0.97 * 0.86 * 0.5;
  const landed = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: landedAt } });
  assert.ok(Math.abs(landed.root.y - base.root.y) < 1e-9, "the fall lands exactly on rest");
  const pre = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: landedAt - 0.01 } });
  assert.ok(pre.root.y < base.root.y, "still airborne just before touchdown");
  const td = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: 0.46 } });
  assert.ok(td.root.sy < base.root.sy, "touchdown squashes");
  assert.ok(td.root.y > base.root.y, "touchdown compresses down");
  // Soft landing: the last 3% of the curve parks on rest, so expiry
  // is never a snap and the tail never creeps.
  const done = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: 0.499 } });
  assert.ok(done.root.y === base.root.y, "last 3% parks exactly on rest");
  const atEnd = sampleMascot(t, { state: "idle", reaction: { name: "hop", age: 0.5 } });
  assert.equal(atEnd.root.y, base.root.y);
  assert.equal(atEnd.root.sy, base.root.sy);
});

test("settle sinks with weight then springs back with one overshoot", () => {
  const t = 3.0;
  const base = sampleMascot(t, { state: "idle" });
  // act one — a brief gather before the sink (a lift, like a breath held)
  const gathered = sampleMascot(t, { state: "idle", reaction: { name: "settle", age: 0.1 } });
  assert.ok(gathered.root.y < base.root.y, "settle gathers up first");
  // act two — sink into the weight
  const sunk = sampleMascot(t, { state: "idle", reaction: { name: "settle", age: 0.4 } });
  assert.ok(sunk.root.y > base.root.y, "settle sinks (sits into the weight)");
  assert.ok(sunk.root.sy < base.root.sy, "settle squashes while sunk");
  // act three — spring back with one overshoot above rest
  const spring = sampleMascot(t, { state: "idle", reaction: { name: "settle", age: 0.75 } });
  assert.ok(spring.root.y < base.root.y, "spring overshoots above rest");
  // No snap at expiry: essentially at rest just before, exact at end.
  const done = sampleMascot(t, { state: "idle", reaction: { name: "settle", age: 0.89 } });
  assert.ok(Math.abs(done.root.y - base.root.y) < 0.05, "settle is essentially back at rest before the reaction ends");
  const atEnd = sampleMascot(t, { state: "idle", reaction: { name: "settle", age: 0.9 } });
  assert.equal(atEnd.root.y, base.root.y);
});

test("celebrate bounces shrink and the face envelope ends closed", () => {
  const t = 3.0;
  const base = sampleMascot(t, { state: "idle" });
  const peaks = [0.1, 0.47, 0.75].map((age) =>
    sampleMascot(t, { state: "idle", reaction: { name: "celebrate", age } }).root.y,
  );
  const [p1, p2, p3] = peaks;
  assert.ok(p1 < base.root.y && p2 < base.root.y && p3 < base.root.y, "all bounces airborne");
  assert.ok(p1 < p2 && p2 < p3, "bounces shrink");
  const ended = sampleMascot(t, { state: "idle", reaction: { name: "celebrate", age: 0.899 } });
  assert.ok(Math.abs(ended.root.y - base.root.y) < 0.01, "celebrate ends near rest");
});

test("glances are deterministic and continuous across windows", () => {
  const near = sampleMascot(6.39, { state: "idle" }).gaze.x;
  const after = sampleMascot(6.41, { state: "idle" }).gaze.x;
  assert.ok(Math.abs(near - after) < 0.3, "look-away eases out before the window wraps");
  assert.equal(
    sampleMascot(0.1, { state: "idle" }).gaze.x,
    sampleMascot(0.1, { state: "idle" }).gaze.x,
  );
});

test("states shape the silhouette, not just the face", () => {
  const neutral = [1, 1, 0];
  const prims = (state) =>
    sampleMascot(0, { state }).body.prims.map((p) => [p.sx, p.sy, p.dy]);
  assert.deepEqual(prims("idle"), [neutral, neutral, neutral], "idle is the drawn shape");
  const top = prims("topup");
  assert.ok(top[2][1] > 1 && top[2][2] < 0, "upper lobe puffs up in topup");
  const stretch = prims("stretch");
  assert.ok(stretch[0][1] > 1 && stretch[2][2] > 0, "stretch elongates the trunk, lobes tuck down");
  const sleepy = prims("sleepy");
  assert.ok(sleepy.every((p) => p[2] > 0), "sleepy droops everything down");
  // Silhouette is state-driven, not motion: reduced motion keeps the shape.
  const still = sampleMascot(0, { state: "topup", reducedMotion: true }).body.prims.map((p) => [p.sx, p.sy, p.dy]);
  assert.deepEqual(still, top, "reduced motion still wears the state's silhouette");
});

test("flight smears along the travel direction and relaxes to rest", () => {
  const t = 3.0;
  // Launch: stretched along the direction, squashed across it.
  const launch = sampleMascot(t, {
    state: "idle",
    smear: { x: 1, y: 0, strength: 1, age: 0 },
  });
  assert.ok(launch.root.smear.sx > 1 && launch.root.smear.sy < 1, "stretches along the flight direction");
  assert.ok(Math.abs(launch.root.smear.angle) < 1e-9, "aligned with +x");
  // A diagonal flight tilts the deform to match.
  const diag = sampleMascot(t, {
    state: "idle",
    smear: { x: 0.7, y: 0.7, strength: 1, age: 0 },
  });
  assert.ok(Math.abs(diag.root.smear.angle - 45) < 0.01, "deform follows the vector");
  // It decays: weaker mid-flight, identity once the window ends.
  const mid = sampleMascot(t, {
    state: "idle",
    smear: { x: 1, y: 0, strength: 1, age: 0.27 },
  });
  assert.ok(mid.root.smear.sx > 1 && mid.root.smear.sx < launch.root.smear.sx, "decays with age");
  const late = sampleMascot(t, {
    state: "idle",
    smear: { x: 1, y: 0, strength: 1, age: 0.55 },
  });
  assert.deepEqual(late.root.smear, { angle: 0, sx: 1, sy: 1 }, "identity at the end of the window");
  // Reduced motion never deforms.
  const still = sampleMascot(t, {
    state: "idle",
    reducedMotion: true,
    smear: { x: 1, y: 0, strength: 1, age: 0 },
  });
  assert.deepEqual(still.root.smear, { angle: 0, sx: 1, sy: 1 }, "reduced motion is never smeared");
});

test("ready arc gathers, exhales, grounds — and lands", () => {
  const base = sampleMascot(3, { state: "idle" });
  const gather = sampleMascot(3, { state: "idle", reaction: { name: "ready", age: 0.2 } });
  assert.ok(gather.root.y > base.root.y, "soften sinks the body down");
  const exhale = sampleMascot(3, { state: "idle", reaction: { name: "ready", age: 0.7 } });
  assert.ok(exhale.root.y < gather.root.y, "exhale releases back up");
  const landed = sampleMascot(3, { state: "idle", reaction: { name: "ready", age: 1.4 } });
  assert.deepEqual(landed, base, "ready parks on exact rest at expiry");
});

test("hush stills the body — bob, wander and glance all quiet", () => {
  const quiet = sampleMascot(3, { state: "idle", presence: "companion", hush: 1 });
  assert.ok(quiet.root.y === 0, "bob is fully stilled");
  const gazeBase = sampleMascot(3, { state: "idle", reducedMotion: true }).gaze;
  assert.deepEqual(quiet.gaze, gazeBase, "hushed gaze matches the static frame");
  const half = sampleMascot(3, { state: "idle", presence: "companion", hush: 0.5 });
  const live = sampleMascot(3, { state: "idle", presence: "companion" });
  assert.ok(Math.abs(half.root.y) < Math.abs(live.root.y) || half.root.y === live.root.y,
    "partial hush never adds motion");
});

test("silhouette deltas blend with the frozen pose", () => {
  const idlePose = sampleMascot(3, { state: "idle" }).pose;
  const mid = sampleMascot(3, { state: "topup", from: idlePose, stateAge: 0.25 });
  const target = sampleMascot(3, { state: "topup" });
  assert.ok(mid.pose.b2y > 1 && mid.pose.b2y < target.pose.b2y, "silhouette keys lerp through");
  const started = sampleMascot(3, { state: "topup", from: idlePose, stateAge: 0 });
  assert.deepEqual(started.pose, idlePose, "blend still starts at the frozen pose");
});
