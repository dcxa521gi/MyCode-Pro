import { useTranslation } from "../../../shared/i18n";
import type { ModelMetadata } from "../model/modelConnections";
import {
  CAPABILITY_LABELS,
  modelCapabilities,
} from "../model/modelCapabilities";
export function ModelCapabilityTags({
  id,
  metadata,
  compact = false,
}: {
  id: string;
  metadata?: ModelMetadata;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const tags = modelCapabilities(id, metadata);
  if (compact && !tags.length) return null;
  return (
    <span
      className="mt-1 flex flex-wrap gap-1"
      aria-label={t("Model capabilities")}
    >
      {tags.length ? (
        (compact ? tags.slice(0, 3) : tags).map(({ capability, evidence }) => (
          <span
            key={capability}
            title={t(
              evidence === "inferred"
                ? "Inferred from model name; verify with provider"
                : evidence === "manual"
                  ? "Manually classified"
                  : "Reported by provider",
            )}
            className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${evidence === "inferred" ? "border-dashed border-content/20 text-content/55" : "border-content/10 bg-content/5 text-content/75"}`}
          >
            {t(CAPABILITY_LABELS[capability])}
            {evidence === "inferred" ? ` · ${t("Inferred")}` : ""}
          </span>
        ))
      ) : (
        <span className="text-[10px] text-content/45">
          {t("Capabilities not reported")}
        </span>
      )}
    </span>
  );
}
