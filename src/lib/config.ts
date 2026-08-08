import Constants from "expo-constants";

type Extra = {
  apiBase: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

/**
 * Config from app.config.ts. Reading it through a checked accessor means a
 * missing value fails at startup with a name, instead of surfacing later as an
 * empty request URL.
 *
 * Nothing here is secret. The Terra API key is never in the bundle.
 */
function readExtra(): Extra {
  const extra = Constants.expoConfig?.extra as Partial<Extra> | undefined;
  const missing: string[] = [];

  if (!extra?.apiBase) missing.push("apiBase");
  if (!extra?.supabaseUrl) missing.push("supabaseUrl");
  if (!extra?.supabasePublishableKey) missing.push("supabasePublishableKey");

  if (missing.length || !extra) {
    throw new Error(`app.config.ts is missing extra: ${missing.join(", ")}`);
  }
  return extra as Extra;
}

export const config = readExtra();
