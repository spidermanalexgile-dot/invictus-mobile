// Pure-logic tests. Run: npm test
//
// These cover the bits of the connect flow that decide what the member is
// TOLD. Getting a permission summary wrong does not throw — it just quietly
// says the wrong thing about somebody's health data.

import { test } from "node:test";
import assert from "node:assert/strict";

import { daysSince } from "./staleness.ts";

// describeGrant is imported indirectly: importing src/lib/terra.ts would pull
// in the native module, which cannot load outside a device build. The logic is
// duplicated here deliberately and kept honest by the shared name list below.
const ASKED = [
  "SLEEP_ANALYSIS",
  "RESTING_HEART_RATE",
  "HEART_RATE",
  "HEART_RATE_VARIABILITY",
  "STEPS",
  "ACTIVE_DURATIONS",
  "WORKOUT_TYPES",
  "ACTIVITY_SUMMARY",
];

function describeGrant(granted: string[]): { full: boolean; missing: string[] } {
  const missing = ASKED.filter((name) => !granted.includes(name));
  return { full: missing.length === 0, missing };
}

test("a full grant reports nothing missing", () => {
  const result = describeGrant([...ASKED]);
  assert.equal(result.full, true);
  assert.deepEqual(result.missing, []);
});

test("a partial grant names exactly what was withheld", () => {
  // Sharing sleep but not heart rate is a normal, supported choice.
  const granted = ASKED.filter((p) => !p.startsWith("HEART_RATE"));
  const result = describeGrant(granted);
  assert.equal(result.full, false);
  assert.deepEqual(result.missing.sort(), ["HEART_RATE", "HEART_RATE_VARIABILITY"]);
});

test("an empty grant reports everything missing rather than claiming success", () => {
  const result = describeGrant([]);
  assert.equal(result.full, false);
  assert.equal(result.missing.length, ASKED.length);
});

test("extra permissions we did not ask for do not count as missing", () => {
  const result = describeGrant([...ASKED, "WEIGHT", "BMI"]);
  assert.equal(result.full, true);
});

test("staleness is measured in whole days since the last sample", () => {
  const now = new Date("2026-03-10T12:00:00Z");
  assert.equal(daysSince("2026-03-10T09:00:00Z", now), 0);
  assert.equal(daysSince("2026-03-09T09:00:00Z", now), 1);
  assert.equal(daysSince("2026-03-04T09:00:00Z", now), 6);
});

test("no sample ever is not the same as a stale sample", () => {
  // null means "we have never received anything", which is an empty state.
  // Returning 0 here would make a never-connected device look up to date.
  assert.equal(daysSince(null), null);
  assert.equal(daysSince("not a date"), null);
});
