// Turns on-screen text into something worth listening to. Without this the
// speech engine reads "1120 ng/mL" as "eleven twenty en gee slash em ell".
const REPLACEMENTS = [
  [/ng\/mL/g, "nanograms per milliliter"],
  [/(\d+)\/4/g, "$1 out of 4"],
  [/•/g, "."],
  [/—/g, ","],
  [/\bft\b/g, "feet"],
  [/\bin\b(?=\s|$)/g, "inches"],
  [/\blbs\b/g, "pounds"],
  [/\bDr\./g, "Doctor"],
];

export function expandForSpeech(text) {
  let spoken = String(text || "");
  REPLACEMENTS.forEach(([pattern, replacement]) => {
    spoken = spoken.replace(pattern, replacement);
  });
  // Collapse whitespace so line breaks don't become long pauses.
  return spoken.replace(/\s+/g, " ").trim();
}
