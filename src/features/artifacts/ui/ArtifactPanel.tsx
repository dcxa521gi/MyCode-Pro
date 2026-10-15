import { useTranslation, formatMessage } from "../../../shared/i18n";
import { useEffect, useRef, useState } from "react";
import { Copy, PanelRightToggle, Trash2 } from "../../../shared/ui/icons";
import { copyMessage } from "../../../platform/tauri/clipboard";
import { IconButton } from "../../../app/shell/TitleBar";
import { MonoSidebarHeader } from "../../monos/ui/MonoSidebar";
import { PageHeader } from "../../monos/ui/monoPanelParts";
import { artifactLabel, deleteArtifact } from "../artifacts";
import { ArtifactContent, useArtifact } from "./ArtifactContent";

/**
 * A document's title, body and actions. With `onBack` it is a page over a
 * list, whose back button and Escape return to that list.
 */
export function ArtifactReader({
  id,
  onBack,
  onClose,
  onOpenFile,
}: {
  id: string;
  onBack?: () => void;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const leave = onBack ?? onClose;
  const { artifact, loaded, error, setError } = useArtifact(id);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => setCopied(false), [id]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        leave();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [leave]);

  const label = artifact ? artifactLabel(artifact.kind) : t("Document");
  const noun = label.toLowerCase();
  const onDelete = async () => {
    if (
      !artifact ||
      deleting ||
      !window.confirm(
        formatMessage("Delete “{value0}”?", { value0: artifact.title }),
      )
    )
      return;
    setDeleting(true);
    setError(null);
    try {
      await deleteArtifact(artifact.id);
      if (mounted.current) leave();
    } catch {
      setError(`Could not delete this ${artifact.kind === "html" ? "visual" : "document"}.`);
    } finally {
      setDeleting(false);
    }
  };
  const actions = artifact ? (
    <>
      <IconButton
        label={formatMessage("Delete {value0}", {value0: noun})}
        disabled={deleting}
        onClick={() => void onDelete()}
      >
        <Trash2 className="size-3.5" />
      </IconButton>
      <IconButton
        label={copied ? t("Copied") : formatMessage("Copy {value0}", {value0: noun})}
        onClick={() =>
          void copyMessage(artifact.body).then(
            () => setCopied(true),
            () => setError(`Could not copy this ${artifact.kind === "html" ? "visual" : "document"}.`),
          )
        }
      >
        <Copy className="size-3.5" />
      </IconButton>
    </>
  ) : null;
  return (
    <>
      {onBack ? (
        <PageHeader title={artifact?.title ?? label} onBack={onBack}>
          {actions}
          <IconButton label={t("Hide overview")} active onClick={onClose}>
            <PanelRightToggle className="size-3.5" strokeWidth={1.75} />
          </IconButton>
        </PageHeader>
      ) : (
        <MonoSidebarHeader title={label} onClose={onClose} actions={actions} />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-4 py-3">
        {!loaded ? (
          <p role="status" className="text-[13px] text-content/50">
            {t("Loading document…")}
          </p>
        ) : error && !artifact ? (
          <p role="alert" className="text-[13px] text-content/65">
            {t(error)}
          </p>
        ) : !artifact ? (
          <p role="status" className="text-[13px] text-content/50">
            {t("This document is no longer available.")}
          </p>
        ) : (
          <article data-artifact-reader={artifact.id}>
            <ArtifactContent artifact={artifact} onOpenFile={onOpenFile} />
            {error ? (
              <p role="alert" className="mt-3 text-[12px] text-content/60">
                {t(error)}
              </p>
            ) : null}
            <span role="status" className="sr-only">
              {copied ? formatMessage("Copied {kind}", {kind: label}) : ""}
            </span>
          </article>
        )}
      </div>
    </>
  );
}
