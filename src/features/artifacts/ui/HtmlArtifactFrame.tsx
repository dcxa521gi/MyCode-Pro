import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { htmlArtifactUrl } from "../artifacts";
import { useTranslation } from "../../../shared/i18n";

type FrameTheme = { scheme: "dark" | "light"; vars: Record<string, string> };

// Page-facing names, resolved to concrete colors: a page cannot see the app's
// own variables, and unresolved `var()` or `color-mix()` would mean nothing there.
const THEME_COLORS: Record<string, string> = {
  "--background": "var(--color-background-base)",
  "--foreground": "var(--color-content)",
  "--muted": "color-mix(in srgb, var(--color-content) 55%, transparent)",
  "--surface": "color-mix(in srgb, var(--color-content) 5%, transparent)",
  "--border": "color-mix(in srgb, var(--color-content) 12%, transparent)",
  "--accent": "var(--color-accent)",
  "--link": "var(--link-color)",
  "--positive": "var(--color-diff-add)",
  "--negative": "var(--color-diff-del)",
};
const CHART_COLORS = [
  "var(--color-accent)",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#a78bfa",
  "#22d3ee",
];

function readTheme(): FrameTheme {
  const root = document.documentElement;
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.appendChild(probe);
  const resolve = (value: string) => {
    probe.style.color = value;
    return getComputedStyle(probe).color;
  };
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(THEME_COLORS))
    vars[name] = resolve(value);
  CHART_COLORS.forEach((value, index) => {
    vars[`--chart-${index + 1}`] = resolve(value);
  });
  probe.remove();
  const style = getComputedStyle(root);
  vars["--font-sans"] = style.getPropertyValue("--font-sans").trim();
  vars["--font-mono"] = style.getPropertyValue("--font-mono").trim();
  vars["--radius"] = "10px";
  return {
    scheme: root.classList.contains("theme-light") ? "light" : "dark",
    vars,
  };
}

/** The app theme as page variables, following theme and appearance changes. */
function useFrameTheme(): FrameTheme {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

const MIN_HEIGHT = 80;
const PLACEHOLDER_HEIGHT = 240;

/**
 * An `html` artifact in a sandboxed frame. It never gets allow-same-origin,
 * so the page runs in an opaque origin with no reach into the app, and its
 * served CSP stops it fetching anything. The frame fits the page's reported
 * height, so the reader around it does the scrolling.
 */
export function HtmlArtifactFrame({
  id,
  title,
  version,
}: {
  id: string;
  title: string;
  /** Changes when the artifact is saved, reloading the page. */
  version: number;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingLinkRef = useRef<string | null>(null);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const { t } = useTranslation();
  const theme = useFrameTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const [ready, setReady] = useState(false);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const postTheme = () =>
    frameRef.current?.contentWindow?.postMessage(
      { type: "monocode:theme", ...themeRef.current },
      "*",
    );
  useEffect(postTheme, [theme]);
  useEffect(() => {
    setReady(false);
    setContentHeight(null);
    pendingLinkRef.current = null;
    setPendingLink(null);
    setOpenFailed(false);
  }, [id, version]);
  // Listen from the commit that inserts the frame, so a fast page's first
  // messages are not missed.
  useLayoutEffect(() => {
    const receive = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data as { type?: unknown } | null;
      if (!data || typeof data !== "object") return;
      if (data.type === "monocode:ready") {
        postTheme();
        setReady(true);
      } else if (data.type === "monocode:height") {
        const height = (data as { height?: unknown }).height;
        if (typeof height === "number" && Number.isFinite(height))
          setContentHeight(Math.max(MIN_HEIGHT, Math.ceil(height)));
      } else if (data.type === "monocode:open-link") {
        const url = (data as { url?: unknown }).url;
        // Focus and frame identity do not prove a link click: page scripts can
        // send this message too. Freeze the first target for parent-owned consent.
        if (
          typeof url === "string" &&
          /^https?:\/\//i.test(url) &&
          document.activeElement === frame &&
          pendingLinkRef.current === null
        ) {
          try {
            const target = new URL(url);
            if (target.protocol !== "http:" && target.protocol !== "https:")
              return;
            pendingLinkRef.current = target.href;
            setPendingLink(target.href);
            setOpenFailed(false);
          } catch {
            // Ignore malformed page requests.
          }
        }
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  const height = contentHeight ?? PLACEHOLDER_HEIGHT;
  const dismissLink = () => {
    // Return focus to the parent before accepting any more frame requests.
    containerRef.current?.focus({ preventScroll: true });
    pendingLinkRef.current = null;
    setPendingLink(null);
  };
  return (
    <div ref={containerRef} tabIndex={-1} className="outline-none">
      {pendingLink && (
        <div
          role="group"
          aria-label={t("Open external link")}
          className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-content/15 bg-content/5 p-3 text-sm text-content"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium">
              {t("Open external link")} · {new URL(pendingLink).host}
            </div>
            <div className="break-all text-xs opacity-70" dir="ltr">
              {pendingLink}
            </div>
          </div>
          <button
            type="button"
            className="rounded-md bg-content/10 px-3 py-1.5 hover:bg-content/15"
            onClick={(event) => {
              if (!event.nativeEvent.isTrusted) return;
              const target = pendingLinkRef.current;
              if (!target) return;
              dismissLink();
              void openUrl(target).catch(() => setOpenFailed(true));
            }}
          >
            {t("Open link")}
          </button>
          <button
            type="button"
            className="rounded-md px-3 py-1.5 hover:bg-content/10"
            onClick={(event) => {
              if (event.nativeEvent.isTrusted) dismissLink();
            }}
          >
            {t("Cancel")}
          </button>
        </div>
      )}
      {openFailed && (
        <p role="status" className="mb-2 text-sm text-content/70">
          {t("Could not open this link.")}
        </p>
      )}
      <iframe
        ref={frameRef}
        data-html-artifact={id}
        src={`${htmlArtifactUrl(id)}?v=${version}`}
        title={title}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        onLoad={() => {
          // Covers a theme change that landed while the page was loading.
          postTheme();
          setReady(true);
        }}
        // Hidden until the page has the theme, so a dark app never flashes the
        // blank white document a frame starts with.
        className="block w-full border-0 transition-opacity duration-150"
        style={{
          height,
          opacity: ready ? 1 : 0,
          colorScheme: ready ? theme.scheme : "light",
        }}
      />
    </div>
  );
}
