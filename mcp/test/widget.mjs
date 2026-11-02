import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { WIDGET_HTML, buildWidgetHtml } from "../widget.js";

const script = WIDGET_HTML.split("<script>")[1].split("</script>")[0];

test("widget renders the shared mascot, not the old orb", () => {
  assert.match(WIDGET_HTML, /createMascot/);
  assert.match(WIDGET_HTML, /id="mascot"/);
  assert.doesNotMatch(WIDGET_HTML, /orb/);
  assert.match(WIDGET_HTML, /sampleMascot/);
});

test("widget is self-contained — no remote imports, assets or eval", () => {
  const withoutNs = WIDGET_HTML.replaceAll("http://www.w3.org/2000/svg", "");
  assert.doesNotMatch(withoutNs, /https?:\/\//);
  assert.doesNotMatch(WIDGET_HTML, /<script[^>]+src=/);
  assert.doesNotMatch(WIDGET_HTML, /<link[^>]+href=/);
  assert.doesNotMatch(WIDGET_HTML, /eval\(|new Function|createObjectURL/);
  assert.doesNotMatch(script, /^\s*(import|export)\s/m);
  assert.doesNotMatch(WIDGET_HTML, /@font-face|\.woff2/);
});

test("embedded widget script parses as a classic script", () => {
  assert.doesNotThrow(() => new vm.Script(script));
});

test("buildWidgetHtml is deterministic and fails loudly on drift", () => {
  assert.equal(buildWidgetHtml(), WIDGET_HTML);
});

test("widget drives phase state, breath progress and completion", () => {
  assert.match(script, /"Breathe in": \{ state: "inhale"/);
  assert.match(script, /"Breathe out": \{ state: "exhale"/);
  assert.match(script, /mascot\.setState\("proud"\)/);
  assert.match(script, /setBreath/);
  assert.match(script, /pagehide/);
  assert.match(script, /textContent/);
  assert.match(script, /if \(running\) return/);
});
