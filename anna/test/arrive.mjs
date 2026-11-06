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
