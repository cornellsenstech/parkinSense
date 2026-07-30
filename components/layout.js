import { useWindowDimensions } from "react-native";

// Shared page widths and the wide-screen test.
//
// A single narrow column wastes a desktop screen, but text stretched across
// 1280px is hard to read — the eye loses its place returning to the left
// margin. So screens cap their width and, above the breakpoint, split into two
// columns instead of growing one very long line.
export const PAGE_WIDTH = 1080;
export const WIDE_WIDTH = 1080;
export const READING_WIDTH = 1080;

// Below this, two columns would each be too narrow to be worth it.
const BREAKPOINT = 900;

export function useWide() {
  const { width } = useWindowDimensions();
  return width >= BREAKPOINT;
}

export function page(maxWidth = PAGE_WIDTH, padding = 20) {
  return {
    padding,
    paddingBottom: 48,
    maxWidth,
    width: "100%",
    alignSelf: "center",
  };
}

// Side-by-side above the breakpoint, stacked below it.
export function columns(wide, gap = 20) {
  return wide ? { flexDirection: "row", alignItems: "flex-start", gap } : null;
}

export function column(wide, flex = 1) {
  return wide ? { flex, minWidth: 0 } : null;
}
