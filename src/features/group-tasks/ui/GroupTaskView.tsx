import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pickFolder } from "../../../platform/tauri/fs";
import { defaultWorkspace } from "../../../platform/tauri/workspace";
import { useTranslation } from "../../../shared/i18n";
import { formatTokenCount } from "../../../shared/lib/tokenCount";
import { BusyIndicator } from "../../../shared/ui/BusyIndicator";
import { AgentMarkdown } from "../../sessions/ui/AgentMarkdown";
import {
  HARNESSES,
  HARNESS_TITLE,
  type HarnessId,
} from "../../sessions/model/session";
import {
  defaultSessionChoice,
  getModelSnapshot,
  modelsFor,
  preferredModelId,
  subscribeModels,
} from "../../sessions/model/models";
import {
  activeTeamRuns,
  createTeamRoom,
  discussInTeam,
  editTeamPlan,
  editTeamRoom,
  getTeamRooms,
  loadTeamRooms,
  proposeTeamPlan,
  runNextTeamStep,
  stopTeamRun,
  subscribeTeams,
  teamSnapshot,
  type TeamAgent,
  type TeamRoom,
} from "../model/groupTasks";

const field =
  "w-full min-w-0 rounded-lg border border-content/10 bg-content/[0.035] px-3 py-2 text-sm outline-none focus:border-content/30";
const button =
  "rounded-lg border border-content/10 bg-content/[0.05] px-3 py-2 text-sm hover:bg-content/10 disabled:opacity-40";
const agent = (manager = false): TeamAgent => ({
  id: crypto.randomUUID(),
  name: "",
  role: "",
  personality: "",
  ...defaultSessionChoice(),
  manager,
});

export function GroupTaskView({
  onClose,
  onOpenSession,
}: {
  onClose: () => void;
  onOpenSession: (id: string) => void;
}) {
  const { t } = useTranslation();
  const errorText = (reason: unknown) =>
    t(String(reason).replace(/^Error:\s*/, ""));
  useSyncExternalStore(subscribeTeams, teamSnapshot, teamSnapshot);
  useSyncExternalStore(subscribeModels, getModelSnapshot, getModelSnapshot);
  const rooms = getTeamRooms();
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<TeamRoom | null>(null);
  const [message, setMessage] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const room = rooms.find((item) => item.id === selected);
  const running = room && activeTeamRuns.get(room.id);
  useEffect(() => {
    void loadTeamRooms().catch((reason) => setError(errorText(reason)));
  }, []);
  useEffect(() => {
    if (!selected && rooms[0]) setSelected(rooms[0].id);
  }, [selected, rooms]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [selected, room?.posts.length]);

  const create = async () => {
    setError("");
    try {
      const cwd = await defaultWorkspace();
      setDraft({
        kind: "mycode-group-task-v1",
        id: crypto.randomUUID(),
        name: "",
        cwd,
        members: [
          { ...agent(), name: t("Participant"), role: t("Researcher") },
          { ...agent(true), name: t("Manager"), role: t("Manager") },
        ],
        memory: "",
        posts: [],
        plans: [],
        tokenLimit: 100000,
        tokensUsed: 0,
        idleEnabled: false,
        idleMinSeconds: 60,
        idleMaxSeconds: 180,
      });
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const save = async () => {
    if (!draft) return;
    const names = draft.members.map((member) => member.name.trim());
    if (
      !draft.name.trim() ||
      names.some((name) => !name) ||
      new Set(names).size !== names.length
    ) {
      setError(t("Give the group and every member a unique name."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createTeamRoom(draft);
      setSelected(draft.id);
      setDraft(null);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setSaving(false);
    }
  };
  const changeAgent = (id: string, change: Partial<TeamAgent>) =>
    setDraft(
      (current) =>
        current && {
          ...current,
          members: current.members.map((member) =>
            member.id === id ? { ...member, ...change } : member,
          ),
        },
    );
  const report = (action: Promise<unknown>) => {
    setError("");
    void action.catch((reason) => setError(errorText(reason)));
  };

  return (
    <section
      className="flex min-h-0 flex-1 overflow-hidden bg-background-base text-content"
      aria-label={t("Group tasks")}
    >
      <aside className="flex w-64 shrink-0 flex-col gap-2 overflow-y-auto border-r border-content/10 bg-content/[0.025] p-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <strong className="text-sm">{t("Group tasks")}</strong>
          <button
            className="text-xs text-content/55 hover:text-content"
            onClick={onClose}
          >
            {t("Back to project")}
          </button>
        </div>
        <button
          className={`${button} w-full text-accent`}
          onClick={() => void create()}
        >
          {t("New group task")}
        </button>
        {rooms.map((item) => (
          <button
            key={item.id}
            className={`rounded-xl p-3 text-left ${selected === item.id && !draft ? "bg-accent/10" : "hover:bg-content/5"}`}
            onClick={() => {
              setSelected(item.id);
              setDraft(null);
              setMessage("");
              setGoal("");
            }}
          >
            <strong className="block truncate text-sm">{item.name}</strong>
            <span className="mt-1 block truncate text-xs text-content/50">
              {item.members.length} {t("Members")} ·{" "}
              {formatTokenCount(item.tokensUsed)} Token
            </span>
          </button>
        ))}
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-5">
        {error && (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 [overflow-wrap:anywhere]"
          >
            {t(error)}
          </p>
        )}
        {draft ? (
          <form
            className="mx-auto w-full max-w-3xl space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div>
              <h2 className="text-lg font-semibold">{t("New group task")}</h2>
              <p className="text-xs text-content/50">
                {t(
                  "Each group task has its own folder, memory and agent team. Automatic idle chat is off.",
                )}
              </p>
            </div>
            <label className="block space-y-1 text-xs">
              {t("Group name")}
              <input
                autoFocus
                className={field}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
            </label>
            <div className="rounded-xl border border-content/10 bg-content/[0.025] p-3">
              <span className="text-xs text-content/50">
                {t("Group task folder")}
              </span>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className="min-w-0 flex-1 truncate text-xs"
                  title={draft.cwd}
                >
                  {draft.cwd}
                </span>
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    report(
                      pickFolder(t("Choose workspace folder")).then((path) => {
                        if (path)
                          setDraft(
                            (current) => current && { ...current, cwd: path },
                          );
                      }),
                    )
                  }
                >
                  {t("Choose folder")}
                </button>
              </div>
            </div>
            {draft.members.map((member) => (
              <section
                key={member.id}
                className="rounded-xl border border-content/10 bg-content/[0.025] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <strong className="text-sm">
                    {t(member.manager ? "Manager" : "Participant")}
                  </strong>
                  {!member.manager && draft.members.length > 2 && (
                    <button
                      type="button"
                      className="text-xs text-content/55"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          members: draft.members.filter(
                            (entry) => entry.id !== member.id,
                          ),
                        })
                      }
                    >
                      {t("Remove")}
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["name", "Nickname"],
                      ["role", "Role"],
                      ["personality", "Personality"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="space-y-1 text-xs">
                      {t(label)}
                      <input
                        className={field}
                        value={member[key]}
                        onChange={(event) =>
                          changeAgent(member.id, { [key]: event.target.value })
                        }
                      />
                    </label>
                  ))}
                  <label className="space-y-1 text-xs">
                    {t("Agent")}
                    <select
                      className={field}
                      value={member.harness}
                      onChange={(event) => {
                        const harness = event.target.value as HarnessId;
                        changeAgent(member.id, {
                          harness,
                          model: preferredModelId(harness),
                        });
                      }}
                    >
                      {HARNESSES.map((harness) => (
                        <option key={harness} value={harness}>
                          {HARNESS_TITLE[harness]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs">
                    {t("Model")}
                    <select
                      className={field}
                      value={member.model}
                      onChange={(event) =>
                        changeAgent(member.id, { model: event.target.value })
                      }
                    >
                      {modelsFor(member.harness).map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            ))}
            <button
              type="button"
              className={button}
              disabled={draft.members.length >= 16}
              onClick={() =>
                setDraft({ ...draft, members: [...draft.members, agent()] })
              }
            >
              {t("Add agent")}
            </button>
            <label className="block space-y-1 text-xs">
              {t("Group memory")}
              <textarea
                className={`${field} min-h-24`}
                maxLength={16000}
                value={draft.memory}
                onChange={(event) =>
                  setDraft({ ...draft, memory: event.target.value })
                }
              />
            </label>
            <label className="block max-w-48 space-y-1 text-xs">
              {t("Token limit")}
              <input
                type="number"
                min={1}
                className={field}
                value={draft.tokenLimit}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    tokenLimit: Math.max(1, Number(event.target.value) || 1),
                  })
                }
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={button}
                onClick={() => setDraft(null)}
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm text-black disabled:opacity-40"
                disabled={saving}
              >
                {t(saving ? "Saving…" : "Create group task")}
              </button>
            </div>
          </form>
        ) : room ? (
          <>
            <header className="mx-auto mb-4 flex w-full max-w-3xl flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold">{room.name}</h2>
                <p
                  className="truncate text-xs text-content/50"
                  title={room.cwd}
                >
                  {room.cwd}
                </p>
              </div>
              <span className="text-xs text-content/50">
                {formatTokenCount(room.tokensUsed)} /{" "}
                {formatTokenCount(room.tokenLimit)} Token
              </span>
            </header>
            <div className="mx-auto w-full max-w-3xl">
              <details className="mb-3 rounded-xl border border-content/10 bg-content/[0.025] p-3">
                <summary className="cursor-pointer text-xs font-medium">
                  {t("Group settings")}
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs">
                    {t("Group memory")}
                    <textarea
                      className={`${field} min-h-20`}
                      defaultValue={room.memory}
                      onBlur={(event) =>
                        report(
                          editTeamRoom(room.id, (value) => ({
                            ...value,
                            memory: event.target.value.slice(0, 16000),
                          })),
                        )
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    {t("Token limit")}
                    <input
                      className={field}
                      type="number"
                      min={1}
                      defaultValue={room.tokenLimit}
                      onBlur={(event) =>
                        report(
                          editTeamRoom(room.id, (value) => ({
                            ...value,
                            tokenLimit: Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          })),
                        )
                      }
                    />
                  </label>
                  <div className="space-y-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!room.idleEnabled}
                        onChange={(event) =>
                          report(
                            editTeamRoom(room.id, (value) => ({
                              ...value,
                              idleEnabled: event.target.checked,
                            })),
                          )
                        }
                      />
                      {t("Enable automatic idle chat")}
                    </label>
                    <p className="text-content/45">
                      {t(
                        "Idle chat stops at the Token limit or when usage is unavailable.",
                      )}
                    </p>
                    <div className="flex gap-2">
                      <label className="min-w-0 flex-1 space-y-1">
                        {t("Minimum interval (seconds)")}
                        <input
                          className={field}
                          type="number"
                          min={30}
                          defaultValue={room.idleMinSeconds ?? 60}
                          onBlur={(event) =>
                            report(
                              editTeamRoom(room.id, (value) => ({
                                ...value,
                                idleMinSeconds: Math.max(
                                  30,
                                  Number(event.target.value) || 60,
                                ),
                              })),
                            )
                          }
                        />
                      </label>
                      <label className="min-w-0 flex-1 space-y-1">
                        {t("Maximum interval (seconds)")}
                        <input
                          className={field}
                          type="number"
                          min={30}
                          defaultValue={room.idleMaxSeconds ?? 180}
                          onBlur={(event) =>
                            report(
                              editTeamRoom(room.id, (value) => ({
                                ...value,
                                idleMaxSeconds: Math.max(
                                  30,
                                  Number(event.target.value) || 180,
                                ),
                              })),
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </details>
              <section
                className="mb-4 rounded-2xl border border-content/10 bg-surface p-4 shadow-sm"
                aria-label={t("Group task plans")}
              >
                <h3 className="text-sm font-semibold">
                  {t("Group task plans")}
                </h3>
                <p className="mb-3 text-xs text-content/50">
                  {t(
                    "The manager proposes a plan. You approve one step at a time before any work starts.",
                  )}
                </p>
                <div className="flex gap-2">
                  <input
                    className={`${field} flex-1`}
                    aria-label={t("Task goal")}
                    placeholder={t(
                      "Describe the result the team should create",
                    )}
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                  />
                  <button
                    className={button}
                    disabled={!goal.trim() || !!running}
                    onClick={() => {
                      const request = goal.trim();
                      setGoal("");
                      report(proposeTeamPlan(room.id, request));
                    }}
                  >
                    {t("Draft plan")}
                  </button>
                </div>
                {room.plans
                  .slice()
                  .reverse()
                  .map((plan) => {
                    const next = plan.steps.find(
                      (step) =>
                        step.status === "pending" || step.status === "failed",
                    );
                    return (
                      <article
                        key={plan.id}
                        className="mt-3 rounded-xl border border-content/10 bg-content/[0.025] p-3"
                      >
                        <div className="flex gap-2">
                          <strong className="min-w-0 flex-1 text-sm">
                            {plan.title}
                          </strong>
                          <span className="text-xs text-content/50">
                            {t(`Group plan status: ${plan.status}`)} ·{" "}
                            {
                              plan.steps.filter(
                                (step) => step.status === "done",
                              ).length
                            }
                            /{plan.steps.length}
                          </span>
                        </div>
                        <ol className="mt-3 space-y-2">
                          {plan.steps.map((step) => (
                            <li
                              key={step.id}
                              className="flex items-start gap-2 text-xs"
                            >
                              <span
                                className={
                                  step.status === "done"
                                    ? "text-emerald-400"
                                    : "text-content/45"
                                }
                              >
                                {step.status === "done" ? "✓" : "○"}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block">{step.title}</span>
                                <span className="text-content/45">
                                  {room.members.find(
                                    (agent) => agent.id === step.agentId,
                                  )?.name ?? t("Unavailable agent")}
                                  {step.status === "failed" && step.handoff
                                    ? ` · ${step.handoff}`
                                    : ""}
                                </span>
                                {step.sessionId && (
                                  <button
                                    className="block text-accent hover:underline"
                                    onClick={() =>
                                      onOpenSession(step.sessionId!)
                                    }
                                  >
                                    {t("Open agent session")}
                                  </button>
                                )}
                              </span>
                              {plan.status === "proposed" && (
                                <select
                                  aria-label={t("Assigned agent")}
                                  className="rounded-md bg-content/5 px-2 py-1"
                                  value={step.agentId}
                                  onChange={(event) =>
                                    report(
                                      editTeamPlan(
                                        room.id,
                                        plan.id,
                                        (value) => ({
                                          ...value,
                                          steps: value.steps.map((item) =>
                                            item.id === step.id
                                              ? {
                                                  ...item,
                                                  agentId: event.target.value,
                                                }
                                              : item,
                                          ),
                                        }),
                                      ),
                                    )
                                  }
                                >
                                  {room.members.map((agent) => (
                                    <option key={agent.id} value={agent.id}>
                                      {agent.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </li>
                          ))}
                        </ol>
                        {next && (
                          <button
                            className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-xs text-black"
                            disabled={!!running}
                            onClick={() =>
                              report(runNextTeamStep(room.id, plan.id))
                            }
                          >
                            {t(
                              plan.status === "proposed"
                                ? "Start first step"
                                : plan.status === "failed"
                                  ? "Retry step"
                                  : plan.status === "stopped"
                                    ? "Resume step"
                                    : "Approve next step",
                            )}
                          </button>
                        )}
                        {plan.status === "proposed" && (
                          <button
                            className="ml-2 rounded-lg px-3 py-1.5 text-xs text-content/60 hover:bg-content/10"
                            onClick={() =>
                              report(
                                editTeamPlan(room.id, plan.id, (value) => ({
                                  ...value,
                                  status: "stopped",
                                })),
                              )
                            }
                          >
                            {t("Discard plan")}
                          </button>
                        )}
                      </article>
                    );
                  })}
              </section>
            </div>
            <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 space-y-3 overflow-y-auto py-3">
              {!room.posts.length && (
                <p className="text-sm text-content/45">
                  {t(
                    "Discuss an idea with the team, or draft a group task above.",
                  )}
                </p>
              )}
              {room.posts.map((post) => (
                <article
                  key={post.id}
                  className={`rounded-2xl p-4 ${post.author === "user" ? "ml-auto w-fit max-w-[85%] bg-accent/10" : "mr-auto w-full bg-content/[0.025]"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs text-content/45">
                    <strong>
                      {post.name === "You" ? t("You") : post.name}
                    </strong>
                    <span>
                      {new Date(post.at).toLocaleTimeString()}
                      {post.tokens != null
                        ? ` · ${formatTokenCount(post.tokens)} Token`
                        : ""}
                    </span>
                  </div>
                  <AgentMarkdown text={post.text} />
                  {!post.error && (
                    <button
                      className="mt-2 text-xs text-content/45 hover:text-accent"
                      onClick={() =>
                        report(
                          editTeamRoom(room.id, (value) => ({
                            ...value,
                            memory:
                              `${value.memory}\n${post.name}: ${post.text}`.slice(
                                -16000,
                              ),
                          })),
                        )
                      }
                    >
                      {t("Add to group memory")}
                    </button>
                  )}
                </article>
              ))}
              <div ref={end} />
            </div>
            <form
              className="mx-auto mt-3 w-full max-w-3xl rounded-2xl border border-content/10 bg-surface p-4 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                if (!message.trim()) return;
                const text = message.trim();
                setMessage("");
                report(discussInTeam(room.id, text));
              }}
            >
              <div className="mb-2 flex flex-wrap gap-2">
                {room.members.map((agent) => (
                  <button
                    type="button"
                    key={agent.id}
                    className="rounded-full bg-content/5 px-2 py-1 text-xs text-content/60"
                    onClick={() =>
                      setMessage((value) => `${value}@${agent.name} `)
                    }
                  >
                    @{agent.name}
                  </button>
                ))}
              </div>
              <textarea
                className={`${field} min-h-20 resize-y`}
                aria-label={t("Message")}
                placeholder={t("Message your group…")}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <div className="mt-2 flex items-center justify-end gap-3">
                {running ? (
                  <>
                    <BusyIndicator label={running.agent} />
                    {running.sessionId && (
                      <button
                        type="button"
                        className={button}
                        onClick={() => onOpenSession(running.sessionId!)}
                      >
                        {t("Open agent session")}
                      </button>
                    )}
                    <button
                      type="button"
                      className={button}
                      onClick={() => stopTeamRun(room.id)}
                    >
                      {t("Stop")}
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 text-sm text-black disabled:opacity-40"
                    disabled={
                      !message.trim() || room.tokensUsed >= room.tokenLimit
                    }
                  >
                    {t("Send")}
                  </button>
                )}
              </div>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-content-center gap-3 text-center">
            <p className="text-sm text-content/50">
              {t("Create a team with different agents and models.")}
            </p>
            <button className={button} onClick={() => void create()}>
              {t("New group task")}
            </button>
          </div>
        )}
      </main>
    </section>
  );
}
