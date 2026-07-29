// Shared page widths.
//
// Text and cards stretched across a 1280px screen are genuinely hard to read —
// the eye loses its place on a line that long. These caps keep every screen to
// a comfortable measure and centre it, while still filling a phone.
export const READING_WIDTH = 640; // single-column patient screens
export const WIDE_WIDTH = 1040; // screens with a sidebar or dense tables

export function page(maxWidth, padding = 20) {
  return {
    padding,
    paddingBottom: 48,
    maxWidth,
    width: "100%",
    alignSelf: "center",
  };
}
