# INVICTUS — companion app

The web app carries the marketplace, the knowledge centre, test ordering,
results and billing. This app is a **companion, not a second platform**. It
ships three surfaces and nothing else:

1. **Reminders** — the ones tied to something already paid for or committed to.
2. **Connected devices and summaries** — a small set of metrics with meaning
   attached, read against the member's blood panel.
3. **Important habits** — a short fixed list, auto-satisfied from device data
   wherever a device can see it.

Everything else deep-links out to the web app.

## Stack

| | |
|---|---|
| Expo SDK | 57 (React Native 0.86.2, React 19.2.3) |
| Router | expo-router, typed routes |
| Language | TypeScript, `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` |
| Workflow | Managed, with continuous native generation. There is no `ios/` in the repo. |
| Auth | Supabase, session in the iOS Keychain via expo-secure-store |
| Wearables | Terra (`terra-react`) |

## You cannot run this in Expo Go

Apple Health has no cloud API. The data lives on the device behind a native
framework, so a native module is required and **Expo Go will not work**.
HealthKit also does not exist in the iOS simulator — a simulator build looks
like it works and then silently returns nothing, which is why the EAS
`development` profile sets `"simulator": false`.

You need a **custom dev build on a physical iPhone**.

```bash
npm install
npx eas build --profile development --platform ios   # cloud build; no local Xcode needed
# install the result on a registered device, then:
npm start
```

Local Xcode is not required. If you do want to build locally you need the full
Xcode app, not just Command Line Tools, plus CocoaPods.

## Server environment

The mobile app holds **no secrets**. Everything sensitive lives on the Vercel
project that serves `/api/terra` (the `invictus-business-plan` repo).

| Variable | Where | Secret |
|---|---|---|
| `TERRA_DEV_ID` | Vercel | No — the SDK needs it and it is returned to the client |
| `TERRA_API_KEY` | Vercel | **Yes.** Never in the bundle, never in EAS env |
| `TERRA_WEBHOOK_SECRET` | Vercel | **Yes.** Signing secret for the webhook destination |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | **Yes** |
| `EXPO_PUBLIC_API_BASE` | eas.json | No |

`EXPO_PUBLIC_*` values are compiled into the bundle by design. Anything that
must stay secret must never be given that prefix.

Point Terra's webhook destination at:

```
https://invictus-business-plan.vercel.app/api/integrations/terra/webhook
```

## How the connection works

```
app  --(Supabase JWT)-->  our backend  --(TERRA_API_KEY)-->  Terra
                               |
                          returns only a short-lived, single-use token
                               |
app  --(token)-->  terra-react initConnection  -->  iOS permission sheet
                               |
                     Terra  --(signed webhook)-->  our backend  -->  Postgres
                               |
app  <--(RLS-scoped read)--  Postgres
```

The API key never reaches the device. Terra's own documentation calls shipping
it in the client acceptable "during the development phase" and "**DO NOT**" in
production.

The token is **single-use**, so a failed connect needs a fresh session rather
than a retry of the same token.

## What we read from Apple Health

Sleep, resting heart rate, heart rate, heart rate variability, steps, active
minutes, workouts, activity summary. That list lives in one place —
`READ_PERMISSIONS` in `src/lib/permissions.ts` — and the on-screen disclosure is
generated from it so the two cannot drift apart.

`permissions.ts` deliberately **imports nothing**. `terra-react`'s entry point
pulls in React Native's `NativeModules`, which cannot load outside a device
build, so anything living beside it was untestable. Keeping the vocabulary and
the grant comparison there means the tests exercise the shipped code rather than
a copy of it. `terra.ts` translates names into SDK enum values at the single
boundary where that has to happen, and a test asserts every name still resolves
— so a rename in `terra-react` fails CI instead of silently requesting fewer
permissions than the disclosure promises.

We do **not** request clinical health records. Terra's setup guide lists
`NSHealthClinicalHealthRecordsShareUsageDescription` next to the other keys; it
asks for a member's medical records, this app has no use for them, and
requesting more than you read is what fails a privacy nutrition label review.

Nothing is written back to Apple Health, and nothing is written to iCloud.

## Deleting data

Disconnecting a provider deletes every measurement imported from it. This is a
**schema guarantee, not a promise in application code**: `health_daily_metrics`
carries a composite foreign key onto `health_connections` that cascades, so
removing the connection removes the data in the same statement. There is also
`purge_health_data(uuid)` for a PDPA data-subject deletion request.

## Things that look fine and are not

- **Daily payloads are cumulative.** Terra resends them through the day, each
  carrying the running total. Summing them would report roughly three times the
  real step count by evening.
- **Deliveries arrive out of order.** Arrival time is not authority; writes are
  guarded on the source's own revision stamp.
- **A nap is not last night's sleep.** Counting it drags duration and onset down
  while looking entirely plausible.
- **iOS never says which reads were denied.** And `grantedPermissions()` also
  resolves an empty array when the SDK has not initialised. Three causes, one
  signal — so `describeGrant` reports `silent`, and the UI says "nothing is
  being shared" rather than "you said no".
- **Permission names come from Terra's native SDKs, not from us.** They are
  compared case- and separator-insensitively, so a `sleepAnalysis` from one
  platform and a `SLEEP_ANALYSIS` from another do not read as withheld.

## Tests

```bash
npm test        # pure logic
npm run typecheck
```

The webhook tests — signature verification, idempotency, out-of-order events —
live with the backend, in the portal repo under `tests/terra.test.js`.

## Phases

| | | |
|---|---|---|
| 1 | Terra + Apple Health end to end | code complete, **awaiting device verification** |
| 2 | Connections screen and summaries | not started |
| 3 | Reminders | not started |
| 4 | Habits | not started |
| 5 | Server-driven push | not started |
