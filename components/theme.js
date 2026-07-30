// One palette for the whole app, so screens cannot drift apart.
//
// Kept high-contrast on purpose: the patient portal is for people with vision
// changes, so "elegant" must never mean low contrast. Semantic colours (good /
// warn / bad) are separate from the neutrals and always paired with an icon and
// a word, never used alone to carry meaning.
export const T = {
  bg: "#f8fafc",
  surface: "#ffffff",
  raised: "#f1f5f9",

  ink: "#0f172a",
  muted: "#475569",
  faint: "#64748b",

  line: "#cbd5e1",
  hair: "#e2e8f0",

  good: "#166534",
  goodBg: "#dcfce7",
  warn: "#9a3412",
  warnBg: "#ffedd5",
  bad: "#991b1b",
  badBg: "#fef2f2",
  badLine: "#fca5a5",

  savedInk: "#b45309",
  savedBg: "#fef3c7",
};

// The small uppercase section label used across screens.
export function sectionLabel(scale) {
  return {
    fontSize: 13 * scale,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: T.faint,
    marginBottom: 10,
  };
}
