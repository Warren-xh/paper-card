import test from "node:test";
import assert from "node:assert/strict";
import * as R from "../js/reading.mjs";

test("reading settings are cleaned and the old theme carries over", () => {
  assert.deepEqual(R.normalizeReading(null), R.DEFAULTS);
  assert.equal(R.normalizeReading(null, "dark").theme, "dark");
  assert.equal(R.normalizeReading({ theme: "sepia" }, "dark").theme, "sepia");
  const s = R.normalizeReading({ theme: "neon", font: "wenkai", size: "xxl", width: "wide", leading: "loose", autoTerms: false });
  assert.deepEqual([s.theme, s.font, s.size, s.width, s.leading, s.autoTerms], ["auto", "wenkai", "m", "wide", "loose", false]);
  assert.equal(R.effectiveTheme("auto", true), "dark");
  assert.equal(R.effectiveTheme("auto", false), "light");
  assert.equal(R.effectiveTheme("sepia", true), "sepia");
  // Every font choice has its stylesheet, and the form shows every option.
  for (const [k] of R.OPTIONS.font) if (k !== "system") assert.ok(R.FONT_CSS[k]?.length, k);
  const html = R.readingFormHtml(R.DEFAULTS, (x) => x);
  for (const key of Object.keys(R.OPTIONS)) for (const [v] of R.OPTIONS[key]) assert.match(html, new RegExp(`data-rs="${key}" data-v="${v}"`));
});
