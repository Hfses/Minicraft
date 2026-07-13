export const colors = {
  bg: "#0b1210",
  bgElevated: "#101b16",
  card: "#14231b",
  cardBorder: "#23402e",
  primary: "#4caf50",
  primaryDark: "#2e7d32",
  text: "#eef7f0",
  textMuted: "#93ad9a",
  danger: "#e57373",
  accent: "#8bc34a",
  gold: "#ffc107",
  online: "#66d97a",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};

/** Deterministic avatar color per name (Multiplayer Master style blocks). */
const AVATAR_COLORS = ["#4caf50", "#26a69a", "#7cb342", "#5c9ded", "#ab7be5", "#ef8354", "#d4a017"];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
