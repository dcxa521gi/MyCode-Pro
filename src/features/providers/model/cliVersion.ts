type Version = { parts: number[]; pre?: string; calendar: boolean };
function versions(text: string): Version[] {
  return [...text.matchAll(/\b(?:v)?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?/gi)]
    .map<Version>((m) => ({
      parts: [Number(m[1]), Number(m[2]), Number(m[3])],
      pre: m[4],
      calendar: Number(m[1]) >= 2000,
    }))
    .concat(
      [...text.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)].map((m) => ({
        parts: [Number(m[1]), Number(m[2]), Number(m[3])],
        pre: undefined,
        calendar: true,
      })),
    );
}
/** Positive means a newer release; null means the vendor formats cannot be compared. */
export function compareCliVersions(
  installed: string,
  latest: string,
): number | null {
  const release = versions(latest)[0];
  if (!release) return null;
  const current = versions(installed).find(
    (v) => v.calendar === release.calendar,
  );
  if (!current) return null;
  for (let i = 0; i < 3; i++)
    if (release.parts[i] !== current.parts[i])
      return release.parts[i] - current.parts[i];
  if (release.calendar) return 0;
  if (current.pre === release.pre) return 0;
  if (!current.pre) return -1;
  if (!release.pre) return 1;
  const a = current.pre.split("."),
    b = release.pre.split(".");
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (a[i] === undefined) return 1;
    if (b[i] === undefined) return -1;
    const an = /^\d+$/.test(a[i]),
      bn = /^\d+$/.test(b[i]);
    if (an && bn) return Number(b[i]) - Number(a[i]);
    if (an !== bn) return an ? 1 : -1;
    return b[i] > a[i] ? 1 : -1;
  }
  return 0;
}
