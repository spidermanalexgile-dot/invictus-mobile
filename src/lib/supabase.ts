import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

import { config } from "./config";

/**
 * Auth session storage.
 *
 * The session is an access token to a member's health data, so it goes in the
 * Keychain rather than AsyncStorage. SecureStore values are capped at 2048
 * bytes; a Supabase session is comfortably under that, but a token that grew
 * past the cap would otherwise fail silently and log the member out with no
 * explanation, so the write is checked.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => {
    if (value.length > 2048) {
      console.warn(`[supabase] session too large for SecureStore (${value.length}B)`);
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase: SupabaseClient = createClient(
  config.supabaseUrl,
  config.supabasePublishableKey,
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      // There is no browser redirect in a native app, so parsing the URL for a
      // session would only ever be a way to get confused.
      detectSessionInUrl: false,
    },
  },
);

/** The current access token, or null when signed out. */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
