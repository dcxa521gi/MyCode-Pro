import { StudioEditor } from "./StudioEditor";
import {
  STUDIO_SPECS,
  studioDefaults,
  studioText,
  studioPrompt,
  studioMediaOptions,
  validateStudio,
} from "../model/studio";
import { localizedError } from "../../../shared/lib/localizedError";
import { useEffect, useState, useSyncExternalStore } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useTranslation } from "../../../shared/i18n";
import { SettingsDropdown } from "../../../shared/ui/SettingsDropdown";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
import { pickFolder } from "../../../platform/tauri/fs";
import { defaultWorkspace } from "../../../platform/tauri/workspace";
import {
  loadLocalAIConfig,
  type ModelConnection,
} from "../../providers/model/modelConnections";
import { modelCapabilities } from "../../providers/model/modelCapabilities";
import { ModelCapabilityTags } from "../../providers/ui/ModelCapabilityTags";
import { HARNESSES } from "../../sessions/model/session";
import {
  modelsFor,
  subscribeModels,
  getModelSnapshot,
} from "../../sessions/model/models";
import { isHarnessAvailable } from "../../../integrations/harness/core/availabilityState";
import {
  WORKBENCH_TASKS,
  workbenchJobs,
  saveWorkbenchJob,
  type WorkbenchJob,
  type WorkbenchAgentInput,
} from "../model/workbench";

const field =
  "w-full rounded-xl border border-content/15 bg-content/[0.035] px-3 py-2.5 text-sm outline-none focus:border-content/35";
type MediaResult = {
  status: string;
  paths: string[];
  text?: string;
  remoteId?: string;
};
export function WorkbenchView({
  onClose,
  onStartAgent,
  onOpenSession,
}: {
  onClose: () => void;
  onStartAgent: (input: WorkbenchAgentInput) => Promise<void>;
  onOpenSession: (id: string) => void;
}) {
  const { t } = useTranslation();
  useSyncExternalStore(subscribeModels, getModelSnapshot, getModelSnapshot);
  const [taskId, setTaskId] = useState<string>(WORKBENCH_TASKS[0].id);
  const task = WORKBENCH_TASKS.find((item) => item.id === taskId)!;
  const spec = STUDIO_SPECS[taskId];
  const [settings, setSettings] = useState(() => studioDefaults(taskId));
  const [prompt, setPrompt] = useState("");
  const [cwd, setCwd] = useState("");
  const [reference, setReference] = useState("");
  const [model, setModel] = useState("");
  const [connections, setConnections] = useState<ModelConnection[]>([]);
  const [jobs, setJobs] = useState(workbenchJobs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showUnknown, setShowUnknown] = useState(false);
  const [imageModel, setImageModel] = useState("");
  const [videoModel, setVideoModel] = useState("");
  useEffect(() => {
    void defaultWorkspace()
      .then(setCwd)
      .catch((e) => setError(localizedError(e)));
    void loadLocalAIConfig()
      .then((config) =>
        setConnections(config.connections.filter((c) => c.enabled)),
      )
      .catch((e) => setError(localizedError(e)));
    for (const job of workbenchJobs()
      .filter((j) => j.connectionId)
      .slice(0, 30)) {
      void invoke<MediaResult | null>("workbench_result", {
        cwd: job.cwd,
        jobId: job.id,
      })
        .then((saved) => {
          if (saved)
            saveWorkbenchJob({
              ...(workbenchJobs().find((j) => j.id === job.id) ?? job),
              ...saved,
            });
        })
        .catch(() => undefined);
    }
    const reload = () => setJobs(workbenchJobs());
    window.addEventListener("mycode:workbench-jobs", reload);
    return () => window.removeEventListener("mycode:workbench-jobs", reload);
  }, []);
  useEffect(() => {
    setModel(localStorage.getItem(`mycode.workbench.model.${taskId}`) ?? "");
    try {
      const draft = JSON.parse(
        localStorage.getItem(`mycode.studio.draft.${taskId}`) ?? "{}",
      );
      setPrompt(typeof draft.prompt === "string" ? draft.prompt : "");
      setReference(typeof draft.reference === "string" ? draft.reference : "");
      setSettings({
        ...studioDefaults(taskId),
        ...Object.fromEntries(
          Object.entries(draft.settings ?? {}).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        ),
      });
    } catch {
      setPrompt("");
      setReference("");
      setSettings(studioDefaults(taskId));
    }
    setImageModel(
      localStorage.getItem(`mycode.workbench.image.${taskId}`) ?? "",
    );
    setVideoModel(
      localStorage.getItem(`mycode.workbench.video.${taskId}`) ?? "",
    );
    setError("");
  }, [taskId]);
  const persistDraft = (next: {
    prompt?: string;
    reference?: string;
    settings?: Record<string, string>;
  }) => {
    localStorage.setItem(
      `mycode.studio.draft.${taskId}`,
      JSON.stringify({ prompt, reference, settings, ...next }),
    );
  };
  const agentModels = HARNESSES.filter(isHarnessAvailable).flatMap(modelsFor);
  const allMediaModels = connections.flatMap((c) =>
    c.models.map((id) => ({
      key: JSON.stringify([c.id, id]),
      id,
      connection: c,
      tags: modelCapabilities(id, c.modelMetadata?.[id]),
    })),
  );
  const mediaModels = allMediaModels.filter(
    (m) =>
      (showUnknown && !m.tags.length) ||
      m.tags.some(
        (tag) =>
          tag.capability ===
          (task.media === "video" ? "video-generation" : "image-generation"),
      ),
  );
  const selectedMedia = mediaModels.find((m) => m.key === model);
  const poll = async (job: WorkbenchJob) => {
    setBusy(true);
    setError("");
    try {
      const result = await invoke<MediaResult>("workbench_request", {
        request: {
          connectionId: job.connectionId,
          model: job.model,
          kind: "video-status",
          prompt: job.prompt,
          cwd: job.cwd,
          jobId: job.id,
          remoteId: job.remoteId,
        },
      });
      saveWorkbenchJob({ ...job, ...result });
    } catch (e) {
      setError(localizedError(e));
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    const invalid = validateStudio(taskId, settings);
    if (invalid) {
      setError(`${t("Check this setting")}: ${invalid}`);
      return;
    }
    const selectedAgent = agentModels.find((m) => m.id === model);
    if (
      !prompt.trim() ||
      !cwd ||
      (task.reference && !reference) ||
      (task.media === "agent" ? !selectedAgent : !selectedMedia)
    ) {
      setError(
        t(
          "Choose a model, output folder and required references, then describe your idea",
        ),
      );
      return;
    }
    const job: WorkbenchJob = {
      id: crypto.randomUUID(),
      task: task.id,
      title: t(task.title),
      prompt: studioPrompt(taskId, prompt.trim(), settings),
      settings: { ...settings },
      cwd,
      reference: task.reference ? reference || undefined : undefined,
      model: selectedMedia?.id ?? model,
      connectionId:
        task.media === "agent" ? undefined : selectedMedia?.connection.id,
      createdAt: Date.now(),
      status: "running",
      paths: [],
      mediaModels: Object.fromEntries(
        [
          ["image", imageModel],
          ["video", videoModel],
        ].flatMap(([kind, key]) => {
          const m = allMediaModels.find((item) => item.key === key);
          return m
            ? [[kind, { connectionId: m.connection.id, model: m.id }]]
            : [];
        }),
      ),
    };
    localStorage.setItem(`mycode.workbench.image.${taskId}`, imageModel);
    localStorage.setItem(`mycode.workbench.video.${taskId}`, videoModel);
    saveWorkbenchJob(job);
    localStorage.setItem(`mycode.workbench.model.${taskId}`, model);
    setBusy(true);
    setError("");
    try {
      if (task.media === "agent") {
        await onStartAgent({
          job,
          task,
          model: selectedAgent!,
          onStarted: (sessionId) => {
            job.sessionId = sessionId;
            saveWorkbenchJob(job);
          },
        });
        saveWorkbenchJob({ ...job, status: "Task finished; review outputs" });
      } else {
        const result = await invoke<MediaResult>("workbench_request", {
          request: {
            connectionId: job.connectionId,
            model: job.model,
            kind: task.media,
            prompt: job.prompt,
            cwd,
            reference: job.reference,
            jobId: job.id,
            options: studioMediaOptions(taskId, settings),
          },
        });
        saveWorkbenchJob({ ...job, ...result });
      }
    } catch (e) {
      saveWorkbenchJob({ ...job, status: "failed", text: localizedError(e) });
      setError(localizedError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background-base text-content"
      aria-label={t("Media Workbench")}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-content/10 px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">{t("Media Workbench")}</h1>
          <p className="mt-1 text-xs text-content/55">
            {t(
              "Create images, videos, stories and presentations with your configured models",
            )}
          </p>
        </div>
        <SecondaryButton onClick={onClose}>{t("Close")}</SecondaryButton>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1">
        <nav
          aria-label={t("Creative tools")}
          className="w-36 shrink-0 space-y-5 overflow-y-auto border-r border-content/10 bg-content/[0.025] p-2 py-5 sm:w-44 lg:w-52 lg:px-3"
        >
          {["Writing", "Images", "Videos", "Design"].map((category) => (
            <div key={category}>
              <h2 className="mb-2 px-3 text-xs font-semibold text-content/45">
                {t(category)}
              </h2>
              <div className="space-y-1">
                {WORKBENCH_TASKS.filter(
                  (item) => item.category === category,
                ).map((item) => (
                  <button
                    key={item.id}
                    disabled={busy}
                    aria-current={taskId === item.id ? "page" : undefined}
                    onClick={() => {
                      persistDraft({});
                      setTaskId(item.id);
                    }}
                    className={`w-full rounded-lg px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50 ${taskId === item.id ? "bg-content/12 font-semibold text-content" : "text-content/65 hover:bg-content/5"}`}
                  >
                    {t(item.title)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <main
          className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 lg:p-7"
          key={taskId}
        >
          <div className="mx-auto max-w-6xl space-y-6">
            <div>
              <p className="mb-2 text-xs text-content/45">
                {t("Media Workbench")} / {t(task.category)}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">
                {t(task.title)}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-content/55">
                {studioText(spec.description)}
              </p>
            </div>
            <div
              className={`grid items-start gap-5 ${spec.layout === "design" ? "xl:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]" : "xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]"}`}
            >
              <div className="min-w-0 space-y-5 rounded-2xl border border-content/10 bg-content/[0.02] p-4 lg:p-5">
                {task.reference && (
                  <div className="space-y-2 text-xs">
                    <span>{t("Reference file")}</span>
                    <div className="flex gap-2">
                      <input readOnly className={field} value={reference} />
                      <SecondaryButton
                        onClick={async () => {
                          const path = await open({
                            multiple: false,
                            directory: false,
                          });
                          if (typeof path === "string") {
                            setReference(path);
                            persistDraft({ reference: path });
                          }
                        }}
                      >
                        {t("Choose file")}
                      </SecondaryButton>
                    </div>
                  </div>
                )}
                <label className="block space-y-2 text-xs">
                  <span className="font-medium">{studioText(spec.prompt)}</span>
                  <textarea
                    className={`${field} ${spec.layout === "writing" ? "min-h-48" : "min-h-32"} resize-y`}
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      persistDraft({ prompt: e.target.value });
                    }}
                    placeholder={studioText(spec.placeholder)}
                    maxLength={50000}
                  />
                </label>
                <StudioEditor
                  id={taskId}
                  values={settings}
                  onChange={(value) => {
                    setSettings(value);
                    persistDraft({ settings: value });
                  }}
                />
              </div>
              <aside className="min-w-0 space-y-4 xl:sticky xl:top-0">
                <div className="space-y-4 rounded-2xl border border-content/10 bg-content/[0.02] p-4 lg:p-5">
                  <h3 className="text-xs font-semibold text-content/65">
                    {t("Models and output")}
                  </h3>
                  <label className="block space-y-2 text-xs">
                    <span>{t("Model")}</span>
                    <SettingsDropdown
                      value={model}
                      onChange={(e) => {
                        setModel(e.target.value);
                        localStorage.setItem(
                          `mycode.workbench.model.${taskId}`,
                          e.target.value,
                        );
                      }}
                    >
                      <option value="">{t("Choose a model")}</option>
                      {task.media === "agent"
                        ? agentModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.provider?.name ?? m.harness} · {m.name}
                            </option>
                          ))
                        : mediaModels.map((m) => (
                            <option key={m.key} value={m.key}>
                              {m.connection.name} ·{" "}
                              {m.connection.modelMetadata?.[m.id]?.name ?? m.id}
                            </option>
                          ))}
                    </SettingsDropdown>
                  </label>
                  {task.media !== "agent" && (
                    <>
                      <label className="flex items-center gap-2 text-xs text-content/60">
                        <input
                          type="checkbox"
                          checked={showUnknown}
                          onChange={(e) => setShowUnknown(e.target.checked)}
                        />
                        {t("Show models with unreported capabilities")}
                      </label>
                      {selectedMedia && (
                        <ModelCapabilityTags
                          id={selectedMedia.id}
                          metadata={
                            selectedMedia.connection.modelMetadata?.[
                              selectedMedia.id
                            ]
                          }
                        />
                      )}
                      <p className="text-xs leading-relaxed text-content/50">
                        {t(
                          "Media generation requires a compatible Images or Videos API. Capability tags alone do not guarantee endpoint support. Your provider may charge for generation.",
                        )}
                      </p>
                    </>
                  )}
                  {task.media === "agent" &&
                    [
                      "picture-book",
                      "presentation",
                      "short-video",
                      "video-recreate",
                      "drama",
                    ].includes(task.id) && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["image", "video"] as const).map((kind) => (
                          <label key={kind} className="space-y-2 text-xs">
                            <span>
                              {t(
                                kind === "image"
                                  ? "Image generation model"
                                  : "Video generation model",
                              )}
                            </span>
                            <SettingsDropdown
                              value={kind === "image" ? imageModel : videoModel}
                              onChange={(e) =>
                                (kind === "image"
                                  ? setImageModel
                                  : setVideoModel)(e.target.value)
                              }
                            >
                              <option value="">
                                {t("Ask before generating media")}
                              </option>
                              {allMediaModels
                                .filter((m) =>
                                  m.tags.some(
                                    (tag) =>
                                      tag.capability ===
                                      (kind === "image"
                                        ? "image-generation"
                                        : "video-generation"),
                                  ),
                                )
                                .map((m) => (
                                  <option key={m.key} value={m.key}>
                                    {m.connection.name} · {m.id}
                                  </option>
                                ))}
                            </SettingsDropdown>
                          </label>
                        ))}
                      </div>
                    )}
                  <div className="space-y-2 text-xs">
                    <span>{t("Output folder")}</span>
                    <div className="flex gap-2">
                      <input readOnly className={field} value={cwd} />
                      <SecondaryButton
                        onClick={async () => {
                          const path = await pickFolder();
                          if (path) setCwd(path);
                        }}
                      >
                        {t("Choose folder")}
                      </SecondaryButton>
                    </div>
                  </div>
                  {error && (
                    <p
                      role="alert"
                      className="break-words text-xs text-red-500"
                    >
                      {error}
                    </p>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => void start()}
                    className="w-full rounded-xl bg-content py-3 text-sm font-medium text-background-base disabled:opacity-40"
                  >
                    {t(busy ? "Submitting…" : "Start creating")}
                  </button>
                </div>
                <div className="space-y-3">
                  <h2 className="text-sm font-medium">
                    {t("Recent creations")}
                  </h2>
                  {!jobs.some((job) => job.task === taskId) && (
                    <p className="py-12 text-center text-xs text-content/45">
                      {t("Your creations will appear here")}
                    </p>
                  )}
                  {jobs
                    .filter((job) => job.task === taskId)
                    .slice(0, 30)
                    .map((job) => (
                      <article
                        key={job.id}
                        className="space-y-2 rounded-xl border border-content/10 bg-content/[0.025] p-3"
                      >
                        <div className="flex justify-between gap-2 text-xs">
                          <strong>{job.title}</strong>
                          <span className="text-content/55">
                            {t(job.status)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs text-content/55">
                          {job.prompt}
                        </p>
                        {job.paths.map((path) => (
                          <div key={path}>
                            {/\.(png|jpg|jpeg|webp)$/i.test(path) ? (
                              <img
                                src={convertFileSrc(path)}
                                alt={job.title}
                                className="my-2 max-h-48 w-full rounded-lg object-contain"
                              />
                            ) : /\.mp4$/i.test(path) ? (
                              <video
                                controls
                                src={convertFileSrc(path)}
                                className="my-2 max-h-48 w-full rounded-lg"
                              />
                            ) : null}
                            <button
                              onClick={() => void openPath(path)}
                              className="max-w-full truncate text-xs underline"
                            >
                              {path.split(/[\\/]/).pop()}
                            </button>
                          </div>
                        ))}
                        {job.text && (
                          <p className="break-words text-xs text-content/65">
                            {job.text}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {job.sessionId && (
                            <SecondaryButton
                              onClick={() => onOpenSession(job.sessionId!)}
                            >
                              {t("Open task")}
                            </SecondaryButton>
                          )}
                          {job.remoteId &&
                            !["completed", "failed"].includes(job.status) && (
                              <SecondaryButton
                                disabled={busy}
                                onClick={() => void poll(job)}
                              >
                                {t("Refresh progress")}
                              </SecondaryButton>
                            )}
                          <SecondaryButton
                            onClick={() => void openPath(job.cwd)}
                          >
                            {t("Open folder")}
                          </SecondaryButton>
                        </div>
                      </article>
                    ))}
                </div>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </section>
  );
}
