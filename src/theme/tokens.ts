/**
 * Design tokens, carried over from the web prototype (m.html) so the two
 * surfaces read as one product. Values are copied deliberately rather than
 * re-picked — a companion app that is nearly the same blue is worse than one
 * that is obviously a different product.
 */

export const color = {
  ink900: "#0E1740",
  ink800: "#14205A",
  ink700: "#1B2A6B",

  blue600: "#2434DE", // primary action
  blue500: "#3D4BEA",
  blue100: "#E4E7FD",
  blue050: "#F1F2FE",

  bg: "#F5F6FC",
  surface: "#FFFFFF",
  surface2: "#F8F9FD",
  border: "#E6E8F4",
  borderStrong: "#CDD2EC",

  text: "#0F1734",
  text2: "#4A5578",
  text3: "#8A93B2",

  teal500: "#12BFA0", // good / done
  teal100: "#DFF7F1",
  amber500: "#F5A524", // in progress / attention
  amber100: "#FDECD2",
  rose500: "#F2685F", // problem / heart
  rose100: "#FDE5E3",
  violet500: "#7B6BE8",
  violet100: "#EDE9FD",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Minimum interactive size. Apple's floor is 44pt and every button, row and
 * toggle in this app honours it — including the ones that look like text.
 */
export const HIT_SIZE = 44;

/**
 * Type scale. Sizes are in points and are ALLOWED TO GROW: every Text in this
 * app leaves Dynamic Type on rather than capping maxFontSizeMultiplier, which
 * is the usual quiet way an app breaks for people who need larger text.
 */
export const type = {
  display: { fontSize: 28, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "700" },
  heading: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400" },
  label: { fontSize: 13, fontWeight: "600" },
  caption: { fontSize: 12, fontWeight: "400" },
} as const;
