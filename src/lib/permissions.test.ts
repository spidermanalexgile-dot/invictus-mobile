// Run: npm test
//
// These test the SHIPPED functions, not a copy of them. `permissions.ts`
// imports nothing, so it loads in plain Node; the terra-react enum is reached
// through its own module file, which is likewise import-free, so even the
// name-to-enum boundary is covered without a device.
//
// What is at stake: getting a permission summary wrong does not throw. It just
// quietly tells someone the wrong thing about their own health data.

import { test } from "node:test";
import assert from "node:assert/strict";

// Deliberately the enum module, not the package entry. terra-react's index
// imports React Native's NativeModules and cannot load outside a device build,
// whereas this file imports nothing at all.
//
// @ts-expect-error terra-react ships its declarations in a parallel tree
// (lib/typescript/...), so this module has no adjacent .d.ts. If the suppression
// ever becomes unnecessary TypeScript will say so, and it should be removed.
import { CustomPermissions } from "../../node_modules/terra-react/lib/module/enums/CustomPermissions.js";

/** The enum as plain data. TypeScript's view of it is `any`; this is not. */
const SDK_ENUM = CustomPermissions as Record<string, number | string | undefined>;

import {
  PERMISSION_LABELS,
  READ_PERMISSIONS,
  describeGrant,
  labelFor,
  normalisePermission,
} from "./permissions.ts";

/* ------------------------------------------------- the terra-react boundary */

test("every permission we ask for exists in terra-react's enum", () => {
  // The drift this catches: terra-react renames or drops a permission, our
  // request silently becomes shorter than the disclosure promises, and nothing
  // fails until a member notices missing data.
  for (const name of READ_PERMISSIONS) {
    assert.equal(typeof SDK_ENUM[name], "number", `CustomPermissions.${name} is missing`);
  }
});

test("the enum round-trips, so the SDK and our names agree both ways", () => {
  for (const name of READ_PERMISSIONS) {
    const value = SDK_ENUM[name];
    assert.equal(typeof value, "number", `CustomPermissions.${name} is missing`);
    assert.equal(SDK_ENUM[String(value)], name, `CustomPermissions[${String(value)}] is not ${name}`);
  }
});

test("we ask for none of the sensitive data we said we would not read", () => {
  // Named explicitly rather than checked by count: a future edit that adds
  // body fat or blood glucose should fail here, loudly.
  const forbidden = [
    "WEIGHT", "BMI", "BODY_FAT", "LEAN_BODY_MASS", "BLOOD_GLUCOSE",
    "BLOOD_PRESSURE", "MENSTRUATION", "LOCATION", "DATE_OF_BIRTH", "GENDER",
  ];
  for (const name of forbidden) {
    assert.ok(
      !(READ_PERMISSIONS as readonly string[]).includes(name),
      `${name} must not be requested — it is outside what the app discloses`,
    );
  }
});

/* --------------------------------------------------------------- disclosure */

test("every requested permission has a plain-language label", () => {
  // The on-screen disclosure renders from this list. A missing label would
  // show a raw enum name to a member.
  for (const name of READ_PERMISSIONS) {
    const label = PERMISSION_LABELS[name];
    assert.equal(typeof label, "string", `${name} has no label`);
    assert.ok(label.length > 0, `${name} has an empty label`);
  }
});

test("an unknown permission falls back to its own name rather than blank", () => {
  assert.equal(labelFor("SOMETHING_NEW"), "SOMETHING_NEW");
  assert.equal(labelFor("STEPS"), "Steps");
});

/* -------------------------------------------------------------- grant logic */

test("a full grant reports nothing missing", () => {
  const result = describeGrant([...READ_PERMISSIONS]);
  assert.equal(result.full, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.silent, false);
});

test("a partial grant names exactly what was withheld", () => {
  // Sharing sleep but withholding heart rate is a normal, supported choice.
  const granted = READ_PERMISSIONS.filter((p) => !p.startsWith("HEART_RATE"));
  const result = describeGrant(granted);
  assert.equal(result.full, false);
  assert.deepEqual([...result.missing].sort(), ["HEART_RATE", "HEART_RATE_VARIABILITY"]);
});

test("an empty grant is reported as silent, not as a refusal", () => {
  // iOS never says which reads were denied, and terra-react also returns an
  // empty array when the SDK is not initialised. Three causes, one signal —
  // so the caller is told "nothing reported", never "the member said no".
  const result = describeGrant([]);
  assert.equal(result.silent, true);
  assert.equal(result.full, false);
  assert.equal(result.missing.length, READ_PERMISSIONS.length);
});

test("extra permissions we did not ask for do not count as missing", () => {
  const result = describeGrant([...READ_PERMISSIONS, "WEIGHT", "BMI"]);
  assert.equal(result.full, true);
});

test("casing and separators from the native side do not read as withheld", () => {
  // The strings come from Terra's native SDKs, not from us. If iOS ever
  // returns "sleepAnalysis" where Android returns "SLEEP_ANALYSIS", a naive
  // comparison would tell the member they had withheld everything.
  const granted = READ_PERMISSIONS.map((p) =>
    p.toLowerCase().replace(/_(.)/g, (_, c: string) => c.toUpperCase()),
  );
  const result = describeGrant(granted);
  assert.equal(result.full, true, `camelCase names should match: ${granted.join(", ")}`);
});

test("normalisation keeps distinct permissions distinct", () => {
  // HEART_RATE is a prefix of HEART_RATE_VARIABILITY; flattening must not
  // collapse them into each other.
  const flattened = new Set(READ_PERMISSIONS.map(normalisePermission));
  assert.equal(flattened.size, READ_PERMISSIONS.length);
});

test("a granted heart rate does not satisfy heart rate variability", () => {
  const result = describeGrant(["HEART_RATE"]);
  assert.ok(result.missing.includes("HEART_RATE_VARIABILITY"));
});
