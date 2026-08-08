import {
  Connections,
  CustomPermissions,
  getActivity,
  getDaily,
  getSleep,
  grantedPermissions,
  initConnection,
  initTerra,
  requestHealthKitPermissions,
} from "terra-react";

import { createTerraSession, type Provider } from "./api";

/**
 * The Apple Health connection, through Terra.
 *
 * Apple Health has no cloud API: the data sits on the device behind a native
 * framework, so a native module is required whichever route we take. Terra
 * gives us that module and, through the same integration and the same webhook,
 * WHOOP, Oura, Garmin, Fitbit and Android Health Connect later.
 *
 * ONE CAVEAT ON THAT, worth knowing before Phase 2: the mobile SDK only speaks
 * to on-device sources — its Connections enum is Apple Health, Health Connect,
 * Samsung, Google Fit and Freestyle Libre. WHOOP, Oura and Garmin are
 * API-based and connect through Terra's hosted widget instead, which is a
 * different call on the backend and an in-app browser here. Same account, same
 * webhook, same normalised payloads; different front door.
 */

/**
 * Exactly what we read, and nothing more.
 *
 * This list is the app's honest answer to "what do you take from my Health
 * app?", and it has to keep matching three other things: the sentence in
 * NSHealthShareUsageDescription, the per-provider disclosure on the Connections
 * screen, and the App Store privacy nutrition label. Adding a permission here
 * without updating those three is how an app ends up rejected — or worse,
 * quietly taking more than it admitted to.
 *
 * Deliberately absent: weight, BMI, body fat, blood glucose, blood pressure,
 * nutrition, menstruation, location. The summaries do not use them.
 */
export const READ_PERMISSIONS: CustomPermissions[] = [
  CustomPermissions.SLEEP_ANALYSIS,
  CustomPermissions.RESTING_HEART_RATE,
  CustomPermissions.HEART_RATE,
  CustomPermissions.HEART_RATE_VARIABILITY,
  CustomPermissions.STEPS,
  CustomPermissions.ACTIVE_DURATIONS,
  CustomPermissions.WORKOUT_TYPES,
  CustomPermissions.ACTIVITY_SUMMARY,
];

/** Plain-language name per permission, for the "what we read" disclosure. */
export const PERMISSION_LABELS: Record<string, string> = {
  SLEEP_ANALYSIS: "Sleep",
  RESTING_HEART_RATE: "Resting heart rate",
  HEART_RATE: "Heart rate",
  HEART_RATE_VARIABILITY: "Heart rate variability",
  STEPS: "Steps",
  ACTIVE_DURATIONS: "Active minutes",
  WORKOUT_TYPES: "Workouts",
  ACTIVITY_SUMMARY: "Activity summary",
};

export type ConnectOutcome =
  | { kind: "connected"; granted: string[]; missing: string[] }
  | { kind: "denied" }
  | { kind: "failed"; message: string };

/**
 * A HealthKit refusal is indistinguishable from "no data yet".
 *
 * iOS deliberately does not tell an app which read permissions were denied —
 * that would leak the fact that someone tracks a condition. So an empty
 * granted list means "denied, or granted with nothing recorded", and the UI
 * must not state the stronger of those two as fact.
 */
export function describeGrant(granted: string[]): {
  full: boolean;
  missing: string[];
} {
  const asked = READ_PERMISSIONS.map((p) => CustomPermissions[p]);
  const missing = asked.filter((name) => !granted.includes(name));
  return { full: missing.length === 0, missing };
}

let initialised = false;

/**
 * Prepares the SDK without showing anything.
 *
 * `requestPermissions: false` is the deferred-prompt pattern: a returning
 * member is recognised silently, and the iOS sheet appears only when they tap
 * Connect. Without it the sheet can ambush someone who merely reinstalled the
 * app, or who opened it on a second device.
 */
export async function prepare(devId: string, referenceId: string): Promise<void> {
  if (initialised) return;
  const res = await initTerra(devId, referenceId, false);
  if (!res.success) {
    throw new Error(res.error ?? "Could not start the health connection.");
  }
  initialised = true;
}

/**
 * Connects Apple Health after an explicit tap.
 *
 * The token comes from our server, which holds the API key. It is single-use,
 * so this is not retryable — a second attempt needs a fresh session.
 */
export async function connectAppleHealth(): Promise<ConnectOutcome> {
  let session;
  try {
    session = await createTerraSession("APPLE_HEALTH" satisfies Provider);
  } catch (err) {
    return { kind: "failed", message: err instanceof Error ? err.message : "Could not connect." };
  }

  try {
    await prepare(session.devId, session.referenceId);

    const res = await initConnection(
      Connections.APPLE_HEALTH,
      session.token,
      true,
      READ_PERMISSIONS,
    );
    if (!res.success) {
      return { kind: "failed", message: res.error ?? "Apple Health did not connect." };
    }

    // What iOS actually handed over, which may be a strict subset of what was
    // asked for. The member is allowed to share sleep and withhold heart rate.
    const granted = await grantedPermissions();
    const { missing } = describeGrant(granted);

    if (granted.length === 0) {
      return { kind: "denied" };
    }
    return { kind: "connected", granted, missing };
  } catch (err) {
    return { kind: "failed", message: err instanceof Error ? err.message : "Could not connect." };
  }
}

/**
 * Re-asks for permissions a returning member has not granted.
 *
 * iOS shows the sheet again only when the requested set has GROWN, or after a
 * reinstall. If it does not appear, the member has to change it in Settings,
 * and the UI needs to say that rather than leaving them tapping.
 */
export async function requestMissingPermissions(): Promise<string[]> {
  const res = await requestHealthKitPermissions(READ_PERMISSIONS);
  if (!res.success) throw new Error(res.error ?? "Could not update permissions.");
  return grantedPermissions();
}

export type BackfillResult = {
  requested: ("daily" | "sleep" | "activity")[];
  failed: { kind: string; error: string }[];
};

/**
 * Pulls history and sends it to our webhook rather than into this process.
 *
 * `toWebhook: true` is the important argument. The device holds the data, but
 * the summaries are computed on the server so the same numbers appear on web
 * and in a monthly review — the app renders, it does not calculate. Asking for
 * more than a month makes Terra chunk the response and announce it with a
 * large_request_processing event, so this returns as soon as the request is
 * accepted, not when the data lands.
 */
export async function backfill(days = 90): Promise<BackfillResult> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const requested: BackfillResult["requested"] = [];
  const failed: BackfillResult["failed"] = [];

  const calls = [
    { kind: "daily" as const, run: () => getDaily(Connections.APPLE_HEALTH, start, end, true) },
    { kind: "sleep" as const, run: () => getSleep(Connections.APPLE_HEALTH, start, end, true) },
    { kind: "activity" as const, run: () => getActivity(Connections.APPLE_HEALTH, start, end, true) },
  ];

  for (const call of calls) {
    try {
      const res = await call.run();
      if (res.success) requested.push(call.kind);
      else failed.push({ kind: call.kind, error: res.error ?? "unknown error" });
    } catch (err) {
      failed.push({ kind: call.kind, error: err instanceof Error ? err.message : "unknown error" });
    }
  }

  return { requested, failed };
}
