// Run: npm test
//
// Staleness only. The permission vocabulary and grant logic moved to
// permissions.ts so the tests could import the real implementation instead of
// a copy — see permissions.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";

import { daysSince } from "./staleness.ts";

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
