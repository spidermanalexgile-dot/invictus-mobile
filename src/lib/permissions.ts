/**
 * What we read from a member's health data — the vocabulary, native-free.
 *
 * This module deliberately imports NOTHING. `terra-react`'s entry point pulls
 * in React Native's NativeModules, which cannot load outside a device build, so
 * anything that lived beside it was untestable. Keeping the vocabulary and the
 * comparison logic here means the shipped code is the tested code; `terra.ts`
 * translates these names into SDK enum values at the one boundary where that
 * has to happen, and `permissions.test.ts` guards that translation.
 */

/**
 * Exactly what we ask Apple Health for, and nothing more.
 *
 * This list is the app's honest answer to "what do you take from my Health
 * app?", and it has to keep matching three other things: the sentence in
 * NSHealthShareUsageDescription, the on-screen disclosure, and the App Store
 * privacy nutrition label. Adding to it without updating those three is how an
 * app gets rejected — or worse, quietly takes more than it admitted to.
 *
 * Deliberately absent: weight, BMI, body fat, blood glucose, blood pressure,
 * nutrition, menstruation, location. The summaries do not use them.
 *
 * Every name here must exist as a key of terra-react's CustomPermissions enum.
 * That is not a convention to remember — it is asserted by a test.
 */
export const READ_PERMISSIONS = [
  "SLEEP_ANALYSIS",
  "RESTING_HEART_RATE",
  "HEART_RATE",
  "HEART_RATE_VARIABILITY",
  "STEPS",
  "ACTIVE_DURATIONS",
  "WORKOUT_TYPES",
  "ACTIVITY_SUMMARY",
] as const;

export type PermissionName = (typeof READ_PERMISSIONS)[number];

/** Plain-language name, for the "what we read" disclosure. */
export const PERMISSION_LABELS: Record<PermissionName, string> = {
  SLEEP_ANALYSIS: "Sleep",
  RESTING_HEART_RATE: "Resting heart rate",
  HEART_RATE: "Heart rate",
  HEART_RATE_VARIABILITY: "Heart rate variability",
  STEPS: "Steps",
  ACTIVE_DURATIONS: "Active minutes",
  WORKOUT_TYPES: "Workouts",
  ACTIVITY_SUMMARY: "Activity summary",
};

/** A label for anything, including a name we do not recognise. */
export function labelFor(name: string): string {
  return (PERMISSION_LABELS as Record<string, string>)[name] ?? name;
}

/**
 * Flattens a permission name for comparison.
 *
 * The strings coming back from `grantedPermissions()` originate in Terra's
 * native SDKs, not in our code, and the two platforms have historically not
 * agreed on casing or separators. Comparing the flattened forms means a
 * "sleepAnalysis" from one build and a "SLEEP_ANALYSIS" from another are the
 * same permission, rather than the UI announcing that a member withheld
 * something they in fact shared.
 */
export function normalisePermission(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type Grant = {
  /** Every permission we asked for was granted. */
  full: boolean;
  /** Those we asked for and did not get. */
  missing: PermissionName[];
  /**
   * True when the SDK reported nothing at all.
   *
   * This is NOT the same as "the member refused". iOS never tells an app which
   * reads were denied — that would leak the fact that somebody tracks a
   * condition — and terra-react resolves an empty array when the SDK has not
   * been initialised yet. So an empty list means "denied, or granted with
   * nothing recorded, or not ready", and the UI must not state any one of
   * those three as fact.
   */
  silent: boolean;
};

/** Compares what iOS handed over against what we asked for. */
export function describeGrant(granted: readonly string[]): Grant {
  const held = new Set(granted.map(normalisePermission));
  const missing = READ_PERMISSIONS.filter((name) => !held.has(normalisePermission(name)));

  return {
    full: missing.length === 0,
    missing: [...missing],
    silent: granted.length === 0,
  };
}
