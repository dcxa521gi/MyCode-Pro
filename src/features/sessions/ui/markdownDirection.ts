// Adapted from Synara's dominant-script direction handling for mixed-language replies.
const RTL = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/u;
const LETTER = /\p{L}/u;

export function markdownBlockDirection(source: string): "rtl" | "ltr" {
  // Code, links and markup should not decide the direction of surrounding prose.
  let fence: string | null = null;
  const prose = source
    .split("\n")
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = null;
        return "";
      }
      if (marker) {
        fence = marker;
        return "";
      }
      return line;
    })
    .join("\n")
    .replace(/`+[^`]*`+/g, " ")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, " ")
    .replace(/\]\([^)]*\)/g, "]");
  let rtlWords = 0;
  let otherWords = 0;
  for (const word of prose.split(/\s+/)) {
    let rtl = 0;
    let other = 0;
    for (const character of word) {
      if (!LETTER.test(character)) continue;
      if (RTL.test(character)) rtl += 1;
      else other += 1;
    }
    if (rtl > other) rtlWords += 1;
    else if (other > 0) otherWords += 1;
  }
  return rtlWords > otherWords ? "rtl" : "ltr";
}
