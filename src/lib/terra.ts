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
import { READ_PERMISSIONS, describeGrant, type PermissionName } from "./permissions";

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
 * The one place a permission name becomes an SDK enum value.
 *
 * The vocabulary itself lives in ./permissions, which imports nothing, so it
 * can be tested. This translation is the only part that needs the native
 * package — and permissions.test.ts asserts that every name resolves, so a
 * rename in terra-react fails a test instead of silently requesting a shorter
 * list of permissions than the disclosure promises.
 */
export function toSdkPermission(name: PermissionName): CustomPermissions {
  const value = CustomPermissions[name];
  if (typeof value !== "number") {
    throw new Error(`terra-react has no CustomPermissions.${name}`);
  }
  return value;
}

/**
 * Built on demand, not at module scope.
 *
 * Throwing here while the module is being imported would take the whole screen
 * down at launch with a blank white view. Called from inside the connect flow,
 * the same failure arrives as a message the member can actually read — and the
 * test makes it something that should never reach a member in the first place.
 */
function requestedPermissions(): CustomPermissions[] {
  return READ_PERMISSIONS.map(toSdkPermission);
}

export type ConnectOutcome =
  | { kind: "connected"; granted: string[]; missing: PermissionName[] }
  | { kind: "denied" }
  | { kind: "failed"; message: string };

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

    const res = await initConnection(Connections.APPLE_HEALTH, session.token, true, requestedPermissions());
    if (!res.success) {
      return { kind: "failed", message: res.error ?? "Apple Health did not connect." };
    }

    // What iOS actually handed over, which may be a strict subset of what was
    // asked for. The member is allowed to share sleep and withhold heart rate.
    const granted = await grantedPermissions();
    const { missing, silent } = describeGrant(granted);

    // Nothing reported. Could be a refusal, could be that the SDK was not
    // ready — terra-react resolves an empty array in both cases — so this is
    // reported as "nothing is being shared", never as "you said no".
    if (silent) return { kind: "denied" };

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
  const res = await requestHealthKitPermissions(requestedPermissions());
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
