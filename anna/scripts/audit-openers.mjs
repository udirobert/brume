// Offline opener audit — a DEV tool, never a runtime signal.
//
// The entity gate in bundle/preparation.js exempts a capitalised token at
// sentence start only if it is in FUNCTION_WORDS ∪ CARD_OPENERS (a closed
// set that errs toward flagging). A frequency list was prototyped as the
// runtime signal and rejected: corpus frequency lists are full of proper
// names, so they would exempt invented names and leak them into the card.
//
// This script uses frequency the SAFE way — offline, to keep the open tier
// (CARD_OPENERS) complete and to pin the bounded name-leak surface:
//   1. leak surface = allowlist words that are also known proper names.
//      These are deliberate common openers that double as names (Will/May/
//      Hope). --check fails if this grows beyond the documented baseline.
//   2. candidate openers = frequent common words (names filtered out) not
//      yet in the allowlist, ranked by frequency, for human review. Add the
//      real imperative verbs / situation nouns to CARD_OPENERS.
//
// No asset is bundled; word lists live in a gitignored cache. No LLM quota.
//
// Usage:
//   node scripts/audit-openers.mjs                 # report (fetches cache if missing)
//   node scripts/audit-openers.mjs --offline       # use cache only, no network
//   node scripts/audit-openers.mjs --top=5000      # candidate depth (default 3000)
//   node scripts/audit-openers.mjs --show=80       # candidates to print (default 60)
//   node scripts/audit-openers.mjs --check         # fail if leak surface grew
//   node scripts/audit-openers.mjs --json          # machine-readable report
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const { FUNCTION_WORDS, CARD_OPENERS } = await import(join(root, "bundle", "preparation.js"));

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const offline = flag("offline");
const asJson = flag("json");
const check = flag("check");
const top = Number(opt("top", "3000"));
const show = Number(opt("show", "60"));
const cacheDir = resolve(opt("cache", join(root, ".cache", "opener-audit")));

// The documented, deliberate name-leak surface: frequent legitimate openers
// that double as given names. --check guards against silent growth.
const BASELINE_LEAK_SURFACE = ["Hope", "May", "Will"];

// Two frequency files from the same corpus. The "no-names" variant is the
// frequency list with proper names curated out; the diff (raw − no-names) is
// a HIGH-PRECISION name set — names that actually occur in English corpus
// frequency. Broad name lists were evaluated and rejected for this use:
// WordPress-user and Unix-propername lists contain junk ("the", "think",
// "just", "my") that would mislabel function words as names. The precision
// set does over-strip a few common words ("new", "best", "big"); those are
// suppressed from candidates, which is acceptable — the retry covers the
// tail and a human reviews every addition.
const SOURCES = [
  { file: "google-10000-english-usa.txt", url: "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa.txt" },
  { file: "google-10000-english-no-names.txt", url: "https://raw.githubusercontent.com/philipperemy/name-dataset/master/tests/google-10000-english-no-names.txt" },
];

const words = (text) => text.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter(Boolean);

async function ensure(source) {
  const path = join(cacheDir, source.file);
  if (existsSync(path)) return readFileSync(path, "utf8");
  if (offline) throw new Error(`Missing cache file ${source.file}. Run without --offline once to fetch it.`);
  mkdirSync(cacheDir, { recursive: true });
  const res = await fetch(source.url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Fetch ${source.url} -> HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(path, text);
  return text;
}

const rawFreq = words(await ensure(SOURCES[0]));
const noNames = new Set(words(await ensure(SOURCES[1])));
// High-precision name set: the names the no-names curator stripped from the
// frequency corpus. Used for BOTH the leak surface and candidate filtering.
const nameSet = new Set(rawFreq.filter((w) => !noNames.has(w)));
const allowlist = new Set([...FUNCTION_WORDS, ...CARD_OPENERS]);
const cap = (w) => w[0].toUpperCase() + w.slice(1);

// 1. Name-leak surface: allowlist words that are also known names.
const leakSurface = [...allowlist].filter((w) => nameSet.has(w.toLowerCase())).sort();
const leakTier = leakSurface.map((w) => ({
  word: w,
  tier: FUNCTION_WORDS.has(w) ? "FUNCTION_WORDS" : "CARD_OPENERS",
}));

// 2. Candidate openers: frequent common words, names filtered, not yet exempt.
const candidates = [];
for (const w of rawFreq.slice(0, top)) {
  if (w.length < 2) continue;
  const c = cap(w);
  if (allowlist.has(c) || nameSet.has(w)) continue;
  candidates.push({ word: c, rank: rawFreq.indexOf(w) + 1 });
}

const unexpected = leakSurface.filter((w) => !BASELINE_LEAK_SURFACE.includes(w));
const report = {
  tool: "opener-audit",
  runtime: false,
  cacheDir,
  allowlistSize: allowlist.size,
  functionWords: FUNCTION_WORDS.size,
  cardOpeners: CARD_OPENERS.size,
  nameSetSize: nameSet.size,
  leakSurface: leakTier,
  baselineLeakSurface: BASELINE_LEAK_SURFACE,
  unexpectedLeakSurface: unexpected,
  candidateDepth: top,
  candidateCount: candidates.length,
  candidates: candidates.slice(0, show),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("Opener audit (offline; no runtime effect, no bundled asset)\n");
  console.log(`Allowlist: ${allowlist.size} words (FUNCTION_WORDS ${FUNCTION_WORDS.size} + CARD_OPENERS ${CARD_OPENERS.size})`);
  console.log(`Name set: ${nameSet.size} corpus-curated names (raw − no-names frequency diff)\n`);
  console.log(`Name-leak surface (${leakSurface.length}) — deliberate openers that double as names:`);
  for (const { word, tier } of leakTier) {
    const mark = BASELINE_LEAK_SURFACE.includes(word) ? "ok" : "NEW";
    console.log(`  [${mark}] ${word} (${tier})`);
  }
  console.log(`\nCandidate openers: ${candidates.length} common words in top-${top} not yet exempt (showing ${Math.min(show, candidates.length)}).`);
  console.log("Review and add real imperative verbs / situation nouns to CARD_OPENERS:\n");
  for (const { word, rank } of candidates.slice(0, show)) console.log(`  ${word.padEnd(16)} #${rank}`);
}

if (check && unexpected.length) {
  console.error(`\nCHECK FAILED: unexpected name-leak surface: ${unexpected.join(", ")}. ` +
    "Either remove the opener or document why it is a safe, deliberate trade.");
  process.exitCode = 1;
}