import { useEffect, useState } from "react";
import { useTranslation } from "../../shared/i18n";
import { fetchRelease, type GitHubRelease } from "../model/githubReleases";
import { AgentMarkdown } from "../../features/sessions/ui/AgentMarkdown";
import { Modal } from "../../shared/ui/Modal";

export function WhatsNewBody({ version }: { version: string }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<GitHubRelease | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setNotes(null);
    setFailed(false);
    void fetchRelease(version, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setNotes(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [version, attempt]);
  return (
    <article aria-label={t("What's new")} className="px-5 py-4">
      {notes ? (
        <AgentMarkdown
          className="whats-new-md"
          text={
            notes.body || t("No release notes were published for this version.")
          }
          streaming={false}
        />
      ) : (
        <p className="text-[13px] text-content/60">
          {t(
            failed
              ? "Couldn't load release notes from GitHub."
              : "Loading release notes…",
          )}
        </p>
      )}
      {failed && (
        <button
          className="mt-3 text-sm text-accent"
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t("Retry")}
        </button>
      )}
    </article>
  );
}
export function WhatsNewDialog({
  version,
  onClose,
}: {
  version: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      onClose={onClose}
      title={t("What's new")}
      description={`MyCode ${version}`}
      size="md"
      className="h-[min(72vh,640px)]"
    >
      <WhatsNewBody version={version} />
    </Modal>
  );
}
