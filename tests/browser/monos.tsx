import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  setLanguage,
  translate as t,
  useTranslation,
} from "../../src/shared/i18n";
import { applyThemePreference } from "../../src/features/settings/model/appearance";
import {
  createMono,
  monoLook,
  saveMonoName,
} from "../../src/features/monos/model/mono";
import { MonoHeader } from "../../src/features/monos/ui/MonoHeader";
import {
  MonoOverview,
  type MonoOverviewTab,
} from "../../src/features/monos/ui/MonoOverview";
import { MonoSettingsDialog } from "../../src/features/monos/ui/MonoSettingsDialog";
import { MonoComposer } from "../../src/features/monos/ui/MonoComposer";
import "../../src/styles/index.css";
const query = new URLSearchParams(location.search);
setLanguage(query.get("lang") === "en" ? "en" : "zh-CN");
applyThemePreference(query.get("theme") === "light" ? "light" : "dark");
const mono = createMono(["/demo"]);
saveMonoName(mono.id, "小助手");
const agent = { ...monoLook(mono), name: "小助手" };
function Fixture() {
  useTranslation();
  const [page, setPage] = useState("");
  const [sent, setSent] = useState("");
  const [tab, setTab] = useState<MonoOverviewTab>("sessions");
  const [documentId, setDocumentId] = useState<string>();
  const [settings, setSettings] = useState(false);
  return (
    <main className="flex h-full min-h-0 bg-background-base text-content">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex gap-4 p-3">
          <button
            data-switch-language
            onClick={() =>
              setLanguage(
                document.documentElement.lang === "zh-CN" ? "en" : "zh-CN",
              )
            }
          >
            Switch language
          </button>
          <button data-open-settings onClick={() => setSettings(true)}>
            {t("Settings")}
          </button>
        </div>
        <MonoHeader
          agent={agent}
          state={{ status: "working", activity: "Thinking" }}
        />
        <div className="flex-1 p-6">
          <p data-opened-file>{page}</p>
          <p data-sent-message>{sent}</p>
        </div>
        <MonoComposer
          sessionId="browser-mono"
          name={agent.name}
          quoteRequest={{
            id: 1,
            text: "Selected context\nThe complete second line",
          }}
          onSubmit={(text) => {
            setSent(text);
            return true;
          }}
        />
      </section>
      <MonoOverview
        open
        monoId={mono.id}
        cwd="/demo"
        agent={agent}
        state={{ status: "idle" }}
        launches={[]}
        sessions={[]}
        documents={[{ id: "doc", kind: "document", title: "发布检查" }]}
        tab={tab}
        onTabChange={setTab}
        onOpenSession={setPage}
        onOpenDocument={setDocumentId}
        shownDocumentId={documentId}
        onBackFromDocument={() => setDocumentId(undefined)}
        onOpenFile={setPage}
        onClose={() => {}}
      />
      {settings && (
        <MonoSettingsDialog
          monoId={mono.id}
          agent={agent}
          status="idle"
          cwd="/demo"
          harness="pi"
          model="fixture-model"
          modelSettings={{}}
          runtimeMode="supervised"
          onModelChange={() => {}}
          onModelSettingsChange={() => {}}
          onRuntimeModeChange={() => {}}
          onClose={() => setSettings(false)}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
