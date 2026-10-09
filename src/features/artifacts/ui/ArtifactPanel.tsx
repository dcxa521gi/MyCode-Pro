import { translate as t, formatMessage } from "../../../shared/i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Copy, Trash2 } from "../../../shared/ui/icons";
import { copyMessage } from "../../../platform/tauri/clipboard";
import { IconButton } from "../../../app/shell/TitleBar";
import { MonoSidebar, MonoSidebarHeader } from "../../monos/ui/MonoSidebar";
import { artifactLabel, deleteArtifact } from "../artifacts";
import { ArtifactContent, useArtifact } from "./ArtifactContent";

export function ArtifactPanel({
  id,
  color,
  onClose,
  onOpenFile,
  windowControls,
}: {
  id: string;
  color: string;
  onClose: () => void;
  onOpenFile?: (path: string) => void;
  windowControls?: ReactNode;
}) {
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
        onClose();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [onClose]);

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
      if (mounted.current) onClose();
    } catch {
      setError(
        formatMessage("Could not delete this {value0}.", { value0: noun }),
      );
    } finally {
      setDeleting(false);
    }
  };
  return (
    <MonoSidebar
      open
      kind="artifact"
      label={`${label} reader`}
      color={color}
      windowControls={windowControls}
    >
      <MonoSidebarHeader
        title={label}
        onClose={onClose}
        actions={
          artifact ? (
            <>
              <IconButton
                label={formatMessage("Delete {value0}", { value0: noun })}
                disabled={deleting}
                onClick={() => void onDelete()}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
              <IconButton
                label={
                  copied
                    ? t("Copied")
                    : formatMessage("Copy {value0}", { value0: noun })
                }
                onClick={() =>
                  void copyMessage(artifact.body).then(
                    () => setCopied(true),
                    () =>
                      setError(
                        formatMessage("Could not copy this {value0}.", {
                          value0: noun,
                        }),
                      ),
                  )
                }
              >
                <Copy className="size-3.5" />
              </IconButton>
            </>
          ) : null
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none px-7 py-6">
        {!loaded ? (
          <p role="status" className="text-[13px] text-content/50">
            {t("Loading document…")}
          </p>
        ) : error && !artifact ? (
          <p role="alert" className="text-[13px] text-content/65">
            {error}
          </p>
        ) : !artifact ? (
          <p role="status" className="text-[13px] text-content/50">
            {t("This document is no longer available.")}
          </p>
        ) : (
          <article data-artifact-reader={artifact.id}>
            <div className="mb-6">
              <h1 className="text-[22px] font-medium leading-snug text-content">
                {artifact.title}
              </h1>
              <p className="mt-2 text-[11px] text-content/45">
                {t("Updated")}
                {new Date(artifact.updatedAt).toLocaleString()}
              </p>
            </div>
            <ArtifactContent artifact={artifact} onOpenFile={onOpenFile} />
            {error ? (
              <p role="alert" className="mt-3 text-[12px] text-content/60">
                {error}
              </p>
            ) : null}
            <span role="status" className="sr-only">
              {copied ? `${label} copied` : ""}
            </span>
          </article>
        )}
      </div>
    </MonoSidebar>
  );
}
