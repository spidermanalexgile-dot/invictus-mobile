import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Button } from "@/components/Button";
import { supabase } from "@/lib/supabase";
import { HIT_SIZE, color, radius, space, type } from "@/theme/tokens";

/**
 * Sign in against the same Supabase project the web app uses, so a member has
 * one account across both. Not one of the three product surfaces — it is the
 * door, and nothing else in the app works without it.
 */
export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading} accessibilityRole="header">
          Sign in
        </Text>
        <Text style={styles.muted}>Use the same account as the Invictus website.</Text>

        <View style={styles.field}>
          <Text style={styles.label} nativeID="email-label">
            Email
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            accessibilityLabel="Email address"
            accessibilityLabelledBy="email-label"
            placeholder="you@example.com"
            placeholderTextColor={color.text3}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label} nativeID="password-label">
            Password
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            autoComplete="current-password"
            accessibilityLabel="Password"
            accessibilityLabelledBy="password-label"
            placeholder="••••••••"
            placeholderTextColor={color.text3}
          />
        </View>

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Button label="Sign in" onPress={submit} busy={busy} disabled={!email || !password} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  body: { padding: space.xl, gap: space.lg },
  heading: { ...type.display, color: color.ink900 },
  muted: { ...type.body, color: color.text2 },
  field: { gap: space.xs },
  label: { ...type.label, color: color.text2 },
  input: {
    minHeight: HIT_SIZE,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    ...type.body,
    color: color.text,
  },
  error: { ...type.body, color: color.rose500 },
});
