import type { ExpoConfig } from "expo/config";

/**
 * INVICTUS companion app — Expo config.
 *
 * The companion is deliberately small. The web app carries the marketplace,
 * the knowledge centre, test ordering, results and billing; this app keeps a
 * subscriber in the loop between three-month cycles and does three things:
 * reminders, connected-device summaries, and a short list of habits.
 *
 * HEALTHKIT
 *   Apple Health has no cloud API — the data lives on the device and needs a
 *   native module either way, so this cannot run in Expo Go and cannot be
 *   tested in the simulator. It needs a custom dev build on a physical iPhone.
 *
 *   We read sleep, heart rate, HRV, steps and workouts. We do NOT request
 *   clinical health records. Terra's setup guide lists
 *   NSHealthClinicalHealthRecordsShareUsageDescription alongside the others,
 *   but that key asks for a member's medical records, which this app has no
 *   use for. Requesting more than we read is exactly what fails a privacy
 *   nutrition label review, so it is omitted on purpose.
 *
 * NO SECRETS HERE
 *   Nothing in this file is a credential. The Terra API key lives only on the
 *   server; the app asks /api/integrations/terra/session for a short-lived
 *   token. EXPO_PUBLIC_* values are compiled into the bundle by design and
 *   must only ever hold public identifiers.
 */

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? "https://invictus-business-plan.vercel.app";

// Supabase publishable key. Public by design: it identifies the project and
// carries no authority of its own — Row Level Security decides what a request
// may see, based on the signed-in member's own token.
const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://luxgsczcpculwxxrxuxo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "sb_publishable_C8qQHZvGaoXA7agRgl-SDg_XNOLyKWo";

const config: ExpoConfig = {
  name: "Invictus",
  slug: "invictus-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "invictus", // every notification deep-links through this
  userInterfaceStyle: "light",
  // No newArchEnabled flag: the New Architecture is the default from SDK 55 on
  // and the key was removed from the config type. terra-react still ships
  // bridge-era native modules, which run through the interop layer — that is
  // the single most likely thing to bite on the first device build, so it is
  // the first thing to check if the SDK fails to initialise.

  ios: {
    bundleIdentifier: "sg.invictus.companion",
    supportsTablet: false,
    infoPlist: {
      // Shown verbatim in the iOS permission sheet. It has to say what we do
      // with the data and why, in the member's language — not "to improve your
      // experience". Apple rejects vague strings, and rightly so.
      NSHealthShareUsageDescription:
        "Invictus reads your sleep, heart rate, heart rate variability, steps and workouts so it can show these trends alongside the results of your blood panel, and mark habits as done without you ticking a box. This data is never used for advertising and is never sold. You can disconnect at any time, which deletes it.",
      NSHealthUpdateUsageDescription:
        "Invictus does not write anything to Apple Health. This permission is requested only because the health framework requires it, and no data is ever saved back to your Health app.",

      // Terra schedules its upload work through BGTaskScheduler under this
      // identifier. Without it the background task is refused at runtime.
      BGTaskSchedulerPermittedIdentifiers: ["co.tryterra.data.post.request"],
      UIBackgroundModes: ["fetch", "processing"],
    },
    entitlements: {
      "com.apple.developer.healthkit": true,
      // Background delivery is what lets Apple Health hand us new samples
      // without the member opening the app. The terra-react config plugin
      // installs the matching setUpBackgroundDelivery() call in AppDelegate.
      "com.apple.developer.healthkit.background-delivery": true,
      // Note the absence of "com.apple.developer.healthkit.access":
      // ["health-records"]. We do not read clinical records.
    },
  },

  android: {
    package: "sg.invictus.companion",
    adaptiveIcon: {
      backgroundColor: "#0E1740",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },

  plugins: [
    "expo-router",
    "expo-secure-store",
    // Patches AppDelegate with Terra.setUpBackgroundDelivery(). This is the
    // only thing terra-react's plugin does — the HealthKit entitlement and the
    // usage strings above are ours to get right.
    "terra-react",
  ],

  experiments: { typedRoutes: true },

  extra: {
    apiBase: API_BASE,
    supabaseUrl: SUPABASE_URL,
    supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
  },
};

export default config;
