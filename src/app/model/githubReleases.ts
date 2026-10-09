/** All update metadata belongs to this fork. No upstream/cloud fallback. */
export const RELEASE_REPOSITORY = "dcxa521gi/MyCode-Pro";
export const RELEASES_URL = `https://github.com/${RELEASE_REPOSITORY}/releases`;

export type GitHubRelease = {
  version: string;
  body: string;
  date: string;
  url: string;
};

export function compareVersions(left: string, right: string): number {
  const parse = (value: string) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(
      value,
    );
    if (!match) throw new Error("Invalid release version");
    return { parts: match.slice(1, 4).map(Number), pre: match[4] };
  };
  const a = parse(left),
    b = parse(right);
  for (let i = 0; i < 3; i++) {
    if (a.parts[i] !== b.parts[i]) return Math.sign(a.parts[i] - b.parts[i]);
  }
  if (a.pre === b.pre) return 0;
  if (!a.pre) return 1;
  if (!b.pre) return -1;
  const ap = a.pre.split("."),
    bp = b.pre.split(".");
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    if (ap[i] === bp[i]) continue;
    if (ap[i] === undefined) return -1;
    if (bp[i] === undefined) return 1;
    const an = /^\d+$/.test(ap[i]),
      bn = /^\d+$/.test(bp[i]);
    if (an && bn) return Math.sign(Number(ap[i]) - Number(bp[i]));
    if (an !== bn) return an ? -1 : 1;
    return ap[i] < bp[i] ? -1 : 1;
  }
  return 0;
}

export async function fetchRelease(
  version?: string,
  signal?: AbortSignal,
  channel: "stable" | "beta" = "stable",
): Promise<GitHubRelease> {
  const endpoint = version
    ? `tags/${encodeURIComponent(`v${version.replace(/^v/, "")}`)}`
    : channel === "beta"
      ? "?per_page=20"
      : "latest";
  const response = await fetch(
    `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases${endpoint.startsWith("?") ? endpoint : `/${endpoint}`}`,
    {
      headers: { Accept: "application/vnd.github+json" },
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
  const payload = await response.json();
  const data = Array.isArray(payload)
    ? payload
        .filter(
          (candidate) =>
            !candidate.draft &&
            typeof candidate.tag_name === "string" &&
            /^v?\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(candidate.tag_name),
        )
        .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0]
    : payload;
  if (
    !data ||
    data.draft ||
    (data.prerelease && channel !== "beta" && !version?.includes("-")) ||
    typeof data.tag_name !== "string"
  )
    throw new Error("Invalid release metadata");
  const releaseVersion = data.tag_name.replace(/^v/, "");
  compareVersions(releaseVersion, releaseVersion);
  if (version && compareVersions(releaseVersion, version) !== 0)
    throw new Error("Release version mismatch");
  return {
    version: releaseVersion,
    body: typeof data.body === "string" ? data.body : "",
    date: typeof data.published_at === "string" ? data.published_at : "",
    // Construct our own trusted link instead of opening an arbitrary API field.
    url: `${RELEASES_URL}/tag/${encodeURIComponent(data.tag_name)}`,
  };
}
