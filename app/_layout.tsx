import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { SessionProvider } from "@/lib/session";
import { color } from "@/theme/tokens";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color.bg },
          headerTintColor: color.ink900,
          headerTitleStyle: { color: color.ink900 },
          contentStyle: { backgroundColor: color.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Invictus" }} />
        <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
        <Stack.Screen name="debug" options={{ title: "Health data (debug)" }} />
      </Stack>
    </SessionProvider>
  );
}
