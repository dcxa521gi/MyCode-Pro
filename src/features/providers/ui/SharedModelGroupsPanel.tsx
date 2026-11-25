import { localizedError } from "../../../shared/lib/localizedError";
import { useEffect, useState } from "react";
import { useTranslation } from "../../../shared/i18n";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import {
  remoteRequest,
  useRemoteMachines,
} from "../../connections/model/connections";
import type {
  HostDescriptor,
  HostProject,
} from "../../connections/model/protocol";
import { remoteCatalogCache } from "../../connections/model/remoteCatalogCache";
import type { ModelGroup } from "../model/modelGroups";

export function SharedModelGroupsPanel({ groups }: { groups: ModelGroup[] }) {
  const { t } = useTranslation();
  const { machines } = useRemoteMachines();
  const [machine, setMachine] = useState("");
  const [project, setProject] = useState("");
  const [groupId, setGroup] = useState("");
  const [projects, setProjects] = useState<HostProject[]>([]);
  const [shared, setShared] = useState<{ id: string; name: string }[]>([]);
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSupported(false);
    setProjects([]);
    setProject("");
    setShared([]);
    if (!machine) return;
    void Promise.all([
      remoteRequest<HostDescriptor>(machine, "environment.describe"),
      remoteRequest<HostProject[]>(machine, "projects.list"),
    ])
      .then(([info, items]) => {
        if (active) {
          setSupported(info.capabilities.includes("modelGroups.v1"));
          setProjects(items);
        }
      })
      .catch((e) => active && setError(localizedError(e)));
    return () => {
      active = false;
    };
  }, [machine]);
  useEffect(() => {
    let active = true;
    setShared([]);
    if (machine && project && supported)
      void remoteRequest<{ id: string; name: string }[]>(
        machine,
        "modelGroups.list",
        { projectId: project },
      )
        .then((items) => active && setShared(items))
        .catch((e) => active && setError(localizedError(e)));
    return () => {
      active = false;
    };
  }, [machine, project, supported]);
  const change = async (method: string, params: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      await remoteRequest(machine, method, params);
      setShared(
        await remoteRequest(machine, "modelGroups.list", {
          projectId: project,
        }),
      );
      const target = machines.find((m) => m.id === machine);
      if (target)
        remoteCatalogCache.invalidate(
          JSON.stringify([machine, target.environmentId, project]),
        );
    } catch (e) {
      setError(localizedError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="rounded-lg border border-content/10 p-3 text-xs">
      <summary className="cursor-pointer font-medium">
        {t("Cross-device model groups")}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="leading-relaxed text-content/60">
          {t(
            "Publish routing rules to a paired computer. Tasks, credentials and account selection stay on that computer. Configure matching models and accounts there before publishing.",
          )}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <SettingsDropdown
            disabled={busy}
            aria-label={t("Execution computer")}
            value={machine}
            onChange={(e) => setMachine(e.target.value)}
          >
            <option value="">{t("Execution computer")}</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SettingsDropdown>
          <SettingsDropdown
            disabled={busy}
            aria-label={t("Project")}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          >
            <option value="">{t("Project")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SettingsDropdown>
          <SettingsDropdown
            disabled={busy}
            aria-label={t("Model group")}
            value={groupId}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">{t("Model group")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SettingsDropdown>
        </div>
        {machine && !supported && (
          <p className="text-content/60">
            {t("Update the execution computer to use shared model groups")}
          </p>
        )}
        <SecondaryButton
          disabled={busy || !supported || !project || !groupId}
          onClick={() =>
            void change("modelGroups.publish", {
              group: groups.find((g) => g.id === groupId),
              projects: [project],
            })
          }
        >
          {t(busy ? "Saving…" : "Publish to this project")}
        </SecondaryButton>
        {shared.map((g) => (
          <div
            key={g.id}
            className="flex items-center justify-between rounded-lg bg-content/5 p-2"
          >
            <span>{g.name}</span>
            <SecondaryButton
              disabled={busy}
              onClick={() => void change("modelGroups.remove", { id: g.id })}
            >
              {t("Revoke group")}
            </SecondaryButton>
          </div>
        ))}
        {error && (
          <p role="alert" className="break-words text-red-500">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
