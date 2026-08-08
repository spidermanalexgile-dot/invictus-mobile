import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { HIT_SIZE, color, radius, space, type } from "@/theme/tokens";

type Variant = "primary" | "secondary" | "danger";

/**
 * Every button is at least 44pt tall, carries a VoiceOver label, and reports
 * its disabled and busy state to assistive technology rather than only looking
 * greyed out.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  hint,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  busy?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const inactive = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...(hint ? { accessibilityHint: hint } : {})}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && !inactive ? styles.pressed : null,
        inactive ? styles.inactive : null,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === "secondary" ? color.blue600 : "#FFFFFF"} />
      ) : (
        <Text style={[styles.label, variant === "secondary" ? styles.labelSecondary : null]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: HIT_SIZE,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: color.blue600 },
  secondary: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.borderStrong },
  danger: { backgroundColor: color.rose500 },
  pressed: { opacity: 0.85 },
  inactive: { opacity: 0.5 },
  label: { ...type.heading, color: "#FFFFFF", textAlign: "center" },
  labelSecondary: { color: color.blue600 },
});
