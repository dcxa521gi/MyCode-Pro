import { SettingsSwitch } from "../../../shared/ui/SettingsSwitch";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import { loadLocalAIConfig } from "../../providers/model/modelConnections";
import { IS_WIN } from "../../../platform/tauri/platform";
import { Modal } from "../../../shared/ui/Modal";

export function PersonalizationSettings({ cwd }: { cwd: string }) {
  const { t } = useTranslation();
  const [instructions, setInstructions] = useState(""),
    [about, setAbout] = useState("");
  const [memory, setMemory] = useState(true),
    [active, setActive] = useState(false);
  const [collected, setCollected] = useState<string[]>([]),
    [manage, setManage] = useState(false);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("");
  useEffect(() => {
    let live = true;
    void loadLocalAIConfig()
      .then((c) => {
        if (!live) return;
        setInstructions(c.customInstructions ?? "");
        setAbout(c.aboutYou ?? "");
        setMemory(c.memoryEnabled !== false);
        setActive(c.activeMemory === true);
        setCollected(
          Object.entries(c.collectedMemories ?? {}).find(
            ([key]) =>
              (IS_WIN ? key.toLowerCase() : key) ===
              (IS_WIN
                ? cwd.replace(/\\/g, "/").toLowerCase()
                : cwd.replace(/\\/g, "/")),
          )?.[1] ?? [],
        );
        setReady(true);
      })
      .catch(() => {
        if (live) setStatus(t("Could not load personalization."));
      });
    return () => {
      live = false;
    };
  }, [cwd, t]);
  const save = async (nextMemory = memory, nextActive = active) => {
    setBusy(true);
    setStatus("");
    try {
      await invoke("local_ai_save_personalization", {
        customInstructions: instructions,
        aboutYou: about,
        memoryEnabled: nextMemory,
        activeMemory: nextActive,
      });
      setMemory(nextMemory);
      setActive(nextActive);
      setStatus(t("Saved. Applies to the next agent turn."));
    } catch {
      setStatus(t("Could not save personalization."));
    } finally {
      setBusy(false);
    }
  };
  const field =
    "min-h-32 w-full resize-y rounded-2xl border border-content/10 bg-content/[0.035] p-4 text-sm leading-relaxed outline-none focus:border-content/30 disabled:opacity-40";
  return (
    <div className="space-y-7">
      {[
        [
          "Custom instructions",
          instructions,
          setInstructions,
          "Define how agents should work, respond and perform tasks on this device.",
        ],
        [
          "About you",
          about,
          setAbout,
          "Tell agents your background and long-term preferences.",
        ],
      ].map(([label, value, change, hint]) => (
        <section key={String(label)}>
          <header className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">{t(String(label))}</h2>
            <button
              disabled={!ready || busy}
              onClick={() => void save()}
              className="rounded-md border border-content/10 px-3 py-1 text-xs hover:bg-content/5 disabled:opacity-40"
            >
              {t(busy ? "Saving…" : "Save")}
            </button>
          </header>
          <textarea
            disabled={!ready || busy}
            aria-label={t(String(label))}
            placeholder={t(String(hint))}
            value={String(value)}
            onChange={(e) => (change as typeof setInstructions)(e.target.value)}
            className={field}
          />
        </section>
      ))}
      <section>
        <h2 className="mb-2 text-sm font-medium">{t("Memory")}</h2>
        <div className="divide-y divide-content/10 rounded-2xl bg-content/[0.035] px-4">
          {[
            ["Memory", memory, "Include saved local memory in agent context."],
            [
              "Active memory",
              active,
              "Keep explicit remember requests in this project's local memory. No inferred personal facts.",
            ],
          ].map(([label, value, hint]) => (
            <div
              key={String(label)}
              className="flex items-center justify-between gap-4 py-4"
            >
              <span>
                <strong className="block text-sm font-medium">
                  {t(String(label))}
                </strong>
                <span className="mt-1 block text-xs leading-relaxed text-content/50">
                  {t(String(hint))}
                </span>
              </span>
              <SettingsSwitch
                label={t(String(label))}
                on={Boolean(value)}
                disabled={
                  !ready || busy || (label === "Active memory" && !memory)
                }
                onChange={(value) =>
                  void (label === "Memory"
                    ? save(value, active)
                    : save(memory, value))
                }
              />
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 py-4">
            <span>
              <strong className="block text-sm font-medium">
                {t("Memory summary")}
              </strong>
              <span className="mt-1 block text-xs text-content/50">
                {t("Review local memories collected for this project.")}
              </span>
            </span>
            <button
              disabled={!ready}
              onClick={() => setManage(true)}
              className="rounded-lg border border-content/10 px-4 py-2 text-xs hover:bg-content/5"
            >
              {t("Manage")}
            </button>
          </div>
        </div>
      </section>
      {status && (
        <p role="status" className="text-xs text-content/60">
          {status}
        </p>
      )}
      {manage && (
        <Modal
          title={t("Memory summary")}
          onClose={() => setManage(false)}
          fitViewport
        >
          <div className="space-y-3 p-4">
            {collected.length ? (
              collected.map((text, index) => (
                <div key={index} className="flex items-start gap-2">
                  <textarea
                    aria-label={`${t("Memory")} ${index + 1}`}
                    value={text}
                    onChange={(e) =>
                      setCollected((items) =>
                        items.map((v, i) => (i === index ? e.target.value : v)),
                      )
                    }
                    className="min-h-20 flex-1 rounded-lg border border-content/10 bg-content/5 p-3 text-sm outline-none"
                  />
                  <button
                    onClick={() =>
                      setCollected((items) =>
                        items.filter((_, i) => i !== index),
                      )
                    }
                    className="rounded-lg border border-content/10 px-3 py-2 text-xs"
                  >
                    {t("Delete")}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-content/50">
                {t("No collected memories yet.")}
              </p>
            )}
            <button
              disabled={busy}
              className="rounded-lg border border-content/10 px-3 py-2 text-xs disabled:opacity-40"
              onClick={() => {
                setBusy(true);
                void invoke("local_ai_edit_collected_memory", {
                  cwd,
                  items: collected,
                })
                  .then(() => {
                    setManage(false);
                    setStatus(t("Saved. Applies to the next agent turn."));
                  })
                  .catch(() => setStatus(t("Could not save personalization.")))
                  .finally(() => setBusy(false));
              }}
            >
              {t("Save")}
            </button>
            <button
              disabled={busy || !collected.length}
              className="rounded-lg border border-content/10 px-3 py-2 text-xs disabled:opacity-40"
              onClick={() => {
                setBusy(true);
                void invoke("local_ai_clear_collected_memory", { cwd })
                  .then(() => setCollected([]))
                  .catch(() => setStatus(t("Could not save personalization.")))
                  .finally(() => setBusy(false));
              }}
            >
              {t("Clear collected memory")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
