import { useLayoutEffect, useRef } from "react";
const prefix = "mycode.storageDrafts.";
const active = new Map<string, string[]>();
export function useProtectedAttachments(attachments: { path?: string }[]) {
  const owner = useRef(crypto.randomUUID());
  useLayoutEffect(() => {
    const key = prefix + owner.current;
    const paths = attachments.flatMap((item) => (item.path ? [item.path] : []));
    active.set(key, paths);
    const save = () => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            at: Date.now(),
            paths,
          }),
        );
      } catch {
        /* Keep the current window's drafts protected if storage is full. */
      }
    };
    save();
    const timer = setInterval(save, 30000);
    return () => {
      clearInterval(timer);
      active.delete(key);
      try {
        localStorage.removeItem(key);
      } catch {
        /* A stale lease expires. */
      }
    };
  }, [attachments]);
}
export function protectedAttachmentPaths(): string[] {
  const paths: string[] = [...active.values()].flat();
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const lease = JSON.parse(localStorage.getItem(key) || "{}");
      if (Date.now() - lease.at < 120000 && Array.isArray(lease.paths))
        paths.push(
          ...lease.paths.filter((value: unknown) => typeof value === "string"),
        );
    } catch {
      /* A stale or incomplete lease cannot supply paths. */
    }
  }
  return [...new Set(paths)];
}
