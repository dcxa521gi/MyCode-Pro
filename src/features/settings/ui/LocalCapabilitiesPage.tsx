import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import { loadLocalAIConfig } from "../../providers/model/modelConnections";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { IS_WIN } from "../../../platform/tauri/platform";

const field =
  "w-full rounded-lg border border-content/15 bg-content/5 p-3 text-sm outline-none focus:border-accent";

export function LocalCapabilitiesPage({ cwd }: { cwd: string }) {
  const { t } = useTranslation();
  const [memory, setMemory] = useState("");
  const [projectMemory, setProjectMemory] = useState("");
  const [mcp, setMcp] = useState("{}");
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    void loadLocalAIConfig()
      .then((config) => {
        if (cancelled) return;
        setMemory(config.memory);
        const normalized = cwd.replace(/\\/g, "/");
        setProjectMemory(
          config.projectMemories[
            IS_WIN ? normalized.toLowerCase() : normalized
          ] ?? "",
        );
        setMcp(JSON.stringify(config.mcpServers ?? {}, null, 2));
        setLoaded(true);
      })
      .catch((e) => {
        if (!cancelled) setStatus(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [cwd]);
  const save = async () => {
    setBusy(true);
    setStatus("");
    try {
      await invoke("local_ai_save_context", {
        memory,
        cwd,
        projectMemory,
        mcpServers: JSON.parse(mcp),
      });
      setStatus(
        "Saved. Memory applies on the next turn; MCP applies to new Claude Code sessions.",
      );
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-6">
      <section className="rounded-xl border border-content/10 p-5">
        <h2 className="mb-2 font-medium">{t("Personal memory")}</h2>
        <p className="mb-3 text-xs leading-relaxed text-content/55">
          {t(
            "Write preferences and reusable facts here. This local memory is included with your next agent request. It is sent only to the model you choose.",
          )}
        </p>
        <textarea
          aria-label={t("Personal memory")}
          disabled={!loaded}
          className={field}
          rows={5}
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
        />
        {cwd && (
          <>
            <h3 className="mb-2 mt-5 text-sm font-medium">
              {t("Project memory")}
            </h3>
            <p className="mb-2 break-all text-xs text-content/40">{cwd}</p>
            <textarea
              aria-label={t("Project memory")}
              disabled={!loaded}
              className={field}
              rows={5}
              value={projectMemory}
              onChange={(e) => setProjectMemory(e.target.value)}
            />
          </>
        )}
      </section>
      <section className="rounded-xl border border-content/10 p-5">
        <h2 className="mb-2 font-medium">{t("Local MCP servers")}</h2>
        <p className="mb-3 text-xs leading-relaxed text-content/55">
          {t(
            "Configure local stdio servers for Claude Code. These commands run on your computer when a new session starts. Existing CLI configuration is preserved.",
          )}
        </p>
        <textarea
          aria-label={t("Local MCP servers")}
          spellCheck={false}
          disabled={!loaded}
          className={`${field} font-mono`}
          rows={9}
          value={mcp}
          onChange={(e) => setMcp(e.target.value)}
        />
        <p className="mt-2 text-xs text-content/40">
          {t(
            "Format: a JSON object keyed by server name, with command and args fields.",
          )}
        </p>
      </section>
      <div>
        <SecondaryButton disabled={busy || !loaded} onClick={() => void save()}>
          {t(busy ? "Saving…" : "Save")}
        </SecondaryButton>
        <p role="status" className="mt-3 text-sm text-content/65">
          {t(status)}
        </p>
      </div>
    </div>
  );
}
