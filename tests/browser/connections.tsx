import { SettingsView } from "../../src/features/settings/ui/SettingsView";
import { ModelConnections } from "../../src/features/providers/ui/ModelConnections";
import { LocalPluginsPanel } from "../../src/features/plugins/ui/LocalPluginsPanel";
import { PluginFormHost } from "../../src/features/plugins/ui/PluginFormHost";
import { requestPluginTool, pluginResult } from "../../src/features/plugins/model/pluginForms";
import { createRoot } from "react-dom/client";
import { MonoRailSection } from "../../src/app/shell/MonoRailSection";
import { ConnectionsSettings } from "../../src/features/connections/ui/ConnectionsSettings";
import { createMono } from "../../src/features/monos/model/mono";
import { setLanguage, useTranslation } from "../../src/shared/i18n";
import { applyThemePreference, saveThemePreference, loadInsetLayout, subscribeInsetLayout } from "../../src/features/settings/model/appearance";
import "../../src/styles/index.css";
const query = new URLSearchParams(location.search);
setLanguage(query.get("lang") === "en" ? "en" : "zh-CN");
applyThemePreference(query.get("theme") === "light" ? "light" : "dark");
saveThemePreference(query.get("theme") === "light" ? "light" : "dark");
const syncLayout = () => document.documentElement.classList.toggle("layout-inset", loadInsetLayout());
syncLayout();
subscribeInsetLayout(syncLayout);
createMono();
function Fixture() {
  useTranslation();
  if (query.has("plugins")) return <main className="mx-auto max-w-4xl bg-background-base p-6 text-content"><LocalPluginsPanel /><button data-request-plugin onClick={() => requestPluginTool("demo", crypto.randomUUID(), { pluginId: "project-review", toolId: "review" })}>Request form</button><output data-plugin-result /><PluginFormHost sessionName={() => "Demo"} onComplete={(id, operation) => { document.querySelector("[data-plugin-result]")!.textContent = JSON.stringify(pluginResult(id, operation)); }}/></main>;
  if (query.has("cli") || query.has("appearance") || query.has("im-bots"))
    return (
      <main className="relative h-full bg-background-base text-content">
        <SettingsView
          section={query.has("appearance") ? "appearance" : query.has("im-bots") ? "im-bots" : "providers-cli"}
          cwd="/demo"
          sessions={[]}
          onClose={() => {}}
          onOpenSession={() => {}}
          onArchiveSession={() => {}}
          onDeleteSession={() => {}}
          onOpenWhatsNew={() => {}}
        />
      </main>
    );
  if (new URLSearchParams(location.search).has("providers"))
    return (
      <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 bg-background-base p-6 text-content">
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
        <ModelConnections />
      </main>
    );
  return (
    <main className="flex h-full bg-background-base text-content">
      <aside className="w-72">
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
        <MonoRailSection
          states={new Map()}
          onOpen={() => {}}
          onCreate={() => {}}
          onDelete={() => {}}
        />
      </aside>
      <section className="flex-1 p-6">
        <ConnectionsSettings />
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
