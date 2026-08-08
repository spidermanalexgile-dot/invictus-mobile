import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { color, radius, space, type } from "@/theme/tokens";

import { Button } from "./Button";

/**
 * The four states every screen in this app handles explicitly.
 *
 * Stale is the one that usually gets forgotten, and here it matters most: a
 * chart drawn from six-day-old data is not a bug the member can see. It looks
 * exactly like a chart of current data. So staleness is stated in words, with
 * the action that fixes it, rather than left to be inferred from a flat line.
 */

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.centre} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={color.blue600} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.centre}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.muted}>{body}</Text>
    </View>
  );
}

export function ErrorState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.centre}>
      <Text style={[styles.title, { color: color.rose500 }]} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.muted}>{body}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

/**
 * Shown when data exists but has stopped arriving.
 *
 * "No data from Apple Health in 6 days — open the Health app to sync" beats a
 * chart of zeros, because the second one is indistinguishable from a member who
 * genuinely did not move.
 */
export function StaleNotice({ days, source }: { days: number; source: string }) {
  return (
    <View
      style={styles.stale}
      accessibilityRole="alert"
      accessibilityLabel={`Warning. No data from ${source} in ${days} days. Open the Health app on your iPhone to sync.`}
    >
      <Text style={styles.staleText}>
        No data from {source} in {days} {days === 1 ? "day" : "days"}. Open the Health app on your
        iPhone to sync.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
    padding: space.xl,
  },
  title: { ...type.heading, color: color.text, textAlign: "center" },
  muted: { ...type.body, color: color.text2, textAlign: "center" },
  stale: {
    backgroundColor: color.amber100,
    borderRadius: radius.md,
    padding: space.md,
    marginVertical: space.sm,
  },
  staleText: { ...type.body, color: color.ink900 },
});
