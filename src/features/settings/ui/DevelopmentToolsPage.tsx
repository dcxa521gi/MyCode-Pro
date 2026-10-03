import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "../../../shared/i18n";
import { BusyIndicator } from "../../../shared/ui/BusyIndicator";
type Tool = { id: string; path: string | null };
const tools = [
  { id: "wechat", name: "WeChat DevTools", actions: ["open", "preview"] },
  { id: "deveco", name: "DevEco Studio", actions: ["open"] },
  { id: "hvigor", name: "HarmonyOS build", actions: ["build"] },
  { id: "hdc", name: "HarmonyOS devices", actions: ["devices"] },
  { id: "adb", name: "Android devices", actions: ["devices"] },
  { id: "gradle", name: "Android build and tests", actions: ["build", "test"] },
  {
    id: "xcode",
    name: "Mac and iOS build and tests",
    actions: ["build", "test"],
  },
];
export function DevelopmentToolsPage({ cwd }: { cwd?: string }) {
  const { t } = useTranslation();
  const [paths, setPaths] = useState<Record<string, string>>(() => {
      try {
        return JSON.parse(
          localStorage.getItem("mycode.developmentTools") ?? "{}",
        );
      } catch {
        return {};
      }
    }),
    [detected, setDetected] = useState<Tool[]>([]),
    [project, setProject] = useState(cwd ?? ""),
    [busy, setBusy] = useState(""),
    [output, setOutput] = useState("");
  const detect = () => {
    setBusy("detect");
    void invoke<Tool[]>("development_detect")
      .then((value) => setDetected(Array.isArray(value) ? value : []))
      .catch(() => setOutput(t("Could not detect developer tools.")))
      .finally(() => setBusy(""));
  };
  useEffect(() => {
    detect();
  }, []);
  const run = async (id: string, action: string) => {
    setBusy(`${id}:${action}`);
    setOutput("");
    try {
      const result = await invoke<{
        success: boolean;
        output: string;
        log?: string;
        timedOut?: boolean;
      }>("development_run", {
        tool: id,
        action,
        cwd: project,
        binary: paths[id] || detected.find((v) => v.id === id)?.path || "",
      });
      setOutput(
        `${t(result.success ? "Completed" : "Could not complete operation")}\n${result.output}${result.log ? `\n${result.log}` : ""}`,
      );
    } catch (error) {
      setOutput(String(error));
    } finally {
      setBusy("");
    }
  };
  return (
    <section className="space-y-4">
      <p className="text-xs leading-relaxed text-content/55">
        {t(
          "Use installed local developer tools for the selected project. Enable WeChat CLI service in DevTools. HarmonyOS uses the project's build profile; Android uses its Gradle wrapper. Mac and iOS require a Mac with Xcode and appropriate signing. No SDK or signing credentials are installed automatically.",
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-content/10 p-3">
        <span className="min-w-0 flex-1 truncate text-xs" title={project}>
          {project || t("Choose a project folder")}
        </span>
        <button
          disabled={!!busy}
          onClick={() =>
            void open({ directory: true, multiple: false }).then((p) => {
              if (typeof p === "string") setProject(p);
            })
          }
          className="rounded-md border border-content/15 px-3 py-2 text-xs hover:bg-selection"
        >
          {t("Choose folder")}
        </button>
        <button
          disabled={!!busy}
          onClick={detect}
          className="rounded-md border border-content/15 px-3 py-2 text-xs hover:bg-selection"
        >
          {t("Detect tools")}
        </button>
      </div>
      {busy && <BusyIndicator label={t("Running local developer tool…")} />}
      <div className="space-y-3">
        {tools.map((tool) => {
          const path =
            paths[tool.id] ||
            detected.find((v) => v.id === tool.id)?.path ||
            "";
          return (
            <div
              key={tool.id}
              className="rounded-xl border border-content/10 bg-content/[0.025] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-medium">{t(tool.name)}</h3>
                <div className="flex gap-2">
                  {tool.actions.map((action) => (
                    <button
                      key={action}
                      disabled={
                        !!busy || !project || (tool.id !== "gradle" && !path)
                      }
                      onClick={() => void run(tool.id, action)}
                      className="rounded-lg border border-content/15 px-3 py-1.5 text-xs hover:bg-selection disabled:opacity-40"
                    >
                      {t(
                        action === "open"
                          ? "Open"
                          : action === "preview"
                            ? "Preview"
                            : action === "devices"
                              ? "Devices"
                              : action === "build"
                                ? "Build"
                                : "Test",
                      )}
                    </button>
                  ))}
                </div>
              </div>
              {tool.id === "gradle" ? (
                <p className="mt-2 text-xs text-content/45">
                  {t(
                    "Uses gradlew in the project folder. APKs are generated in the project's build folder.",
                  )}
                </p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <input
                    aria-label={`${t(tool.name)} ${t("Executable path")}`}
                    value={path}
                    onChange={(e) => {
                      const next = { ...paths, [tool.id]: e.target.value };
                      setPaths(next);
                      localStorage.setItem(
                        "mycode.developmentTools",
                        JSON.stringify(next),
                      );
                    }}
                    placeholder={t("Executable path")}
                    className="min-w-0 flex-1 rounded-lg border border-content/10 bg-content/5 px-3 py-2 text-xs outline-none"
                  />
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      void open({ directory: false, multiple: false }).then(
                        (p) => {
                          if (typeof p === "string") {
                            const next = { ...paths, [tool.id]: p };
                            setPaths(next);
                            localStorage.setItem(
                              "mycode.developmentTools",
                              JSON.stringify(next),
                            );
                          }
                        },
                      )
                    }
                    className="rounded-lg border border-content/15 px-3 text-xs hover:bg-selection"
                  >
                    {t("Browse")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {output && (
        <pre
          role="status"
          className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-content/5 p-4 font-mono text-xs"
        >
          {output}
        </pre>
      )}
    </section>
  );
}
