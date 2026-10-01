import {
  useComposerBehavior,
  shouldSend,
  numberedNewline,
} from "../../sessions/model/composerBehavior";
import { open } from "@tauri-apps/plugin-dialog";
import { listSkills, type DiscoveredSkill } from "../../../platform/tauri/fs";
import { loadDisabledSkillPaths } from "../../skills/model/skills";
import { defaultWorkspace } from "../../../platform/tauri/workspace";
import { useEffect, useState, useSyncExternalStore, useRef } from "react";
import { AgentMarkdown } from "../../sessions/ui/AgentMarkdown";
import { BusyIndicator } from "../../../shared/ui/BusyIndicator";
import { useTranslation } from "../../../shared/i18n";
import { pickFolder } from "../../../platform/tauri/fs";
import { formatTokenCount } from "../../../shared/lib/tokenCount";
import {
  HARNESSES,
  HARNESS_TITLE,
  type HarnessId,
} from "../../sessions/model/session";
import {
  defaultSessionChoice,
  modelsFor,
  preferredModelId,
  subscribeModels,
  getModelSnapshot,
} from "../../sessions/model/models";
import {
  getGroups,
  groupsVersion,
  subscribeGroups,
  loadGroups,
  saveGroup,
  updateGroup,
  runGroup,
  stopGroup,
  groupRuns,
  type Group,
  type Member,
} from "../model/groups";
const field =
  "w-full rounded-lg bg-content/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";
const button =
  "rounded-lg bg-content/5 px-3 py-2 text-sm hover:bg-content/10 disabled:opacity-40";
const newMember = (manager = false): Member => ({
  id: crypto.randomUUID(),
  name: "",
  role: "",
  personality: "",
  gender: "",
  ...defaultSessionChoice(),
  manager,
});
export function GroupChats({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const composerBehavior = useComposerBehavior();
  useSyncExternalStore(subscribeGroups, groupsVersion);
  useSyncExternalStore(subscribeModels, getModelSnapshot);
  const groups = getGroups();
  const [selected, setSelected] = useState(groups[0]?.id || "");
  const [draft, setDraft] = useState<Group | null>(null);
  const [draftTexts, setDraftTexts] = useState<Record<string, string>>({});
  const text = draftTexts[selected] || "";
  const setText = (next: string | ((old: string) => string)) =>
    setDraftTexts((current) => ({
      ...current,
      [selected]:
        typeof next === "function" ? next(current[selected] || "") : next,
    }));
  const messagesEnd = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState<DiscoveredSkill[]>([]);
  const [execute, setExecute] = useState(false);
  const group = groups.find((g) => g.id === selected);
  useEffect(() => {
    if (!selected && groups[0]) setSelected(groups[0].id);
  }, [selected, groups]);
  const running = group ? groupRuns.get(group.id) : undefined;
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [selected, group?.messages.length]);
  const create = async () => {
    setError("");
    try {
      const cwd = await defaultWorkspace();
      setDraft({
        id: crypto.randomUUID(),
        name: "",
        cwd,
        members: [
          { ...newMember(), name: t("Participant"), role: t("Researcher") },
          { ...newMember(true), name: t("Manager"), role: t("Manager") },
        ],
        memory: "",
        messages: [],
        idle: false,
        minSeconds: 60,
        maxSeconds: 180,
        tokenLimit: 100000,
        tokens: 0,
      });
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    void loadGroups().catch((e) => setError(String(e)));
  }, []);
  const updateMember = (id: string, patch: Partial<Member>) => {
    if (draft)
      setDraft({
        ...draft,
        members: draft.members.map((m) =>
          m.id === id ? { ...m, ...patch } : m,
        ),
      });
  };
  const save = async () => {
    if (!draft) return;
    if (
      !draft.name.trim() ||
      draft.members.some((m) => !m.name.trim()) ||
      new Set(draft.members.map((m) => m.name.trim())).size !==
        draft.members.length
    ) {
      setError(t("Give the group and every member a unique name."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveGroup(draft);
      setSelected(draft.id);
      setDraft(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      aria-label={t("Group chats")}
      className="flex min-h-0 flex-1 flex-col bg-background-base text-content"
    >
      <div className="flex h-full min-h-0 flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 space-y-2 overflow-y-auto border-r border-content/10 bg-content/[0.025] p-3">
          <button
            className={`${button} w-full text-accent`}
            onClick={() => void create()}
          >
            {t("New group chat")}
          </button>
          <button
            className="mb-2 w-full text-left text-xs text-content/60 hover:text-content"
            onClick={onClose}
          >
            {t("Back to project")}
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              className={`w-full rounded-xl p-3 text-left text-sm ${selected === g.id ? "bg-accent/10" : "hover:bg-content/5"}`}
              onClick={() => {
                setSelected(g.id);
                setDraft(null);
                setExecute(false);
              }}
            >
              <strong className="block truncate">{g.name}</strong>
              <span className="text-xs text-content/50">
                {g.members.length} {t("Members")} · {formatTokenCount(g.tokens)}{" "}
                Token
              </span>
              {groupRuns.has(g.id) && (
                <span className="ml-2 text-accent">●</span>
              )}
            </button>
          ))}
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-5">
          {error && (
            <p
              role="alert"
              className="mb-3 break-words rounded-lg bg-red-500/10 p-3 text-sm text-red-400"
            >
              {t(error)}
            </p>
          )}
          {draft ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <label className="block space-y-1 text-sm">
                {t("Group name")}
                <input
                  className={field}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <div className="flex items-center gap-3">
                <p className="min-w-0 flex-1 break-all text-xs text-content/60">
                  {draft.cwd}
                </p>
                <button
                  type="button"
                  className={button}
                  disabled={groups.some((g) => g.id === draft.id)}
                  onClick={() =>
                    void pickFolder(t("Choose workspace folder"))
                      .then((cwd) => {
                        if (cwd) setDraft({ ...draft, cwd });
                      })
                      .catch((e) => setError(String(e)))
                  }
                >
                  {t("Change folder")}
                </button>
              </div>
              <p className="text-xs text-content/50">
                {t(
                  "Each group stores its files and memory in an independent subfolder. Automatic chat is off by default.",
                )}
              </p>
              {draft.members.map((m) => (
                <section
                  key={m.id}
                  className="space-y-3 rounded-xl bg-content/[0.035] p-4"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-sm">
                      {m.manager ? t("Manager") : t("Participant")}
                    </strong>
                    {!m.manager && draft.members.length > 2 && (
                      <button
                        type="button"
                        className="text-xs text-content/50"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            members: draft.members.filter((x) => x.id !== m.id),
                          })
                        }
                      >
                        {t("Remove")}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(
                      [
                        ["name", "Nickname"],
                        ["role", "Role"],
                        ["personality", "Personality"],
                        ["gender", "Gender"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="space-y-1 text-xs">
                        {t(label)}
                        <input
                          className={field}
                          value={m[key]}
                          onChange={(e) =>
                            updateMember(m.id, { [key]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1 text-xs">
                      {t("Agent")}
                      <select
                        className={field}
                        value={m.harness}
                        onChange={(e) => {
                          const harness = e.target.value as HarnessId;
                          updateMember(m.id, {
                            harness,
                            model: preferredModelId(harness),
                          });
                        }}
                      >
                        {HARNESSES.map((h) => (
                          <option key={h} value={h}>
                            {HARNESS_TITLE[h]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      {t("Model")}
                      <select
                        className={field}
                        value={m.model}
                        onChange={(e) =>
                          updateMember(m.id, { model: e.target.value })
                        }
                      >
                        {modelsFor(m.harness).map((model) => (
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
                  setDraft({
                    ...draft,
                    members: [...draft.members, newMember()],
                  })
                }
              >
                {t("Add agent")}
              </button>
              <label className="block space-y-1 text-sm">
                {t("Group memory")}
                <textarea
                  className={`${field} min-h-24`}
                  maxLength={16000}
                  value={draft.memory}
                  onChange={(e) =>
                    setDraft({ ...draft, memory: e.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["minSeconds", "Minimum interval (seconds)"],
                    ["maxSeconds", "Maximum interval (seconds)"],
                    ["tokenLimit", "Token limit"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="space-y-1 text-xs">
                    {t(label)}
                    <input
                      type="number"
                      min={key === "tokenLimit" ? 1 : 30}
                      className={field}
                      value={draft[key]}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [key]: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs text-content/50">
                {t(
                  "The limit pauses new turns; a running turn may exceed it. Automatic chat pauses when token usage is unavailable.",
                )}
              </p>
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
                  disabled={saving}
                  className="rounded-lg bg-accent px-4 py-2 text-sm text-black"
                >
                  {t(saving ? "Saving…" : "Save")}
                </button>
              </div>
            </form>
          ) : group ? (
            <>
              <header className="mb-4 flex flex-wrap items-center gap-3">
                <h3 className="min-w-0 flex-1 truncate font-semibold">
                  {group.name}
                </h3>
                <span className="text-xs text-content/50">
                  {formatTokenCount(group.tokens)} /{" "}
                  {formatTokenCount(group.tokenLimit)} Token
                </span>
                <button
                  className={button}
                  disabled={!!running}
                  onClick={() => setDraft(structuredClone(group))}
                >
                  {t("Group settings")}
                </button>
                <button
                  className={button}
                  onClick={() =>
                    void updateGroup(group.id, { idle: !group.idle }).catch(
                      (e) => setError(String(e)),
                    )
                  }
                >
                  {t(
                    group.idle
                      ? "Pause automatic chat"
                      : "Enable automatic chat",
                  )}
                </button>
              </header>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6">
                {!group.messages.length && (
                  <p className="text-sm text-content/50">
                    {t(
                      "Ask your team a question. Mention an agent with @name, or include a project/session ID to reference its content.",
                    )}
                  </p>
                )}
                {group.messages.map((m) => (
                  <article
                    key={m.id}
                    className={`mx-auto w-full max-w-3xl rounded-2xl p-4 ${m.author === "user" ? "bg-content/5" : ""}`}
                  >
                    <div className="mb-2 flex justify-between text-xs text-content/50">
                      <strong>{m.name === "You" ? t("You") : m.name}</strong>
                      <span>
                        {new Date(m.at).toLocaleTimeString()}
                        {m.tokens != null
                          ? ` · ${formatTokenCount(m.tokens)} Token`
                          : ""}
                      </span>
                    </div>
                    <AgentMarkdown text={m.text} />
                    {!m.error && (
                      <button
                        className="mt-2 text-xs text-content/45 hover:text-accent"
                        onClick={() =>
                          void updateGroup(group.id, {
                            memory:
                              `${group.memory}\n${m.name}: ${m.text}`.slice(
                                -16000,
                              ),
                          }).catch((e) => setError(String(e)))
                        }
                      >
                        {t("Add to group memory")}
                      </button>
                    )}
                  </article>
                ))}
                <div ref={messagesEnd} />
              </div>
              <form
                className="mx-auto mt-4 w-full max-w-3xl shrink-0 space-y-3 rounded-2xl border border-content/10 bg-surface p-4 shadow-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!text.trim()) return;
                  const message = text;
                  setText("");
                  void runGroup(group.id, message, false, execute).catch((e) =>
                    setError(String(e)),
                  );
                  setExecute(false);
                }}
              >
                <div className="flex flex-wrap gap-2">
                  {group.members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="rounded-full bg-content/5 px-2 py-1 text-xs text-content/60"
                      onClick={() =>
                        setText((current) => `${current}@${m.name} `)
                      }
                    >
                      @{m.name}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      void open({ multiple: true, directory: false })
                        .then((paths) => {
                          if (paths)
                            setText(
                              (value) =>
                                `${value}\n${t("Referenced files")}:\n${(Array.isArray(paths) ? paths : [paths]).join("\n")}`,
                            );
                        })
                        .catch((e) => setError(String(e)))
                    }
                  >
                    {t("Reference files")}
                  </button>
                  <button
                    type="button"
                    className={button}
                    onClick={() =>
                      void listSkills(group.cwd, loadDisabledSkillPaths())
                        .then(setSkills)
                        .catch((e) => setError(String(e)))
                    }
                  >
                    {t("Reference skills")}
                  </button>
                  {skills.length > 0 && (
                    <select
                      aria-label={t("Reference skills")}
                      className={`${field} !w-48`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          setText(
                            (value) =>
                              `${value}\n${t("Use this skill")}: ${e.target.value}`,
                          );
                      }}
                    >
                      <option value="">{t("Choose a skill")}</option>
                      {skills.map((skill) => (
                        <option key={skill.path} value={skill.path}>
                          {skill.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <textarea
                  className={`${field} min-h-24 resize-y`}
                  aria-label={t("Message")}
                  placeholder={t("Message your group…")}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing || e.key !== "Enter") return;
                    if (shouldSend(e, composerBehavior.sendKey)) {
                      e.preventDefault();
                      if (!running && text.trim())
                        e.currentTarget.form?.requestSubmit();
                      return;
                    }
                    const next = composerBehavior.numberedLists
                      ? numberedNewline(
                          text,
                          e.currentTarget.selectionStart,
                          e.currentTarget.selectionEnd,
                        )
                      : null;
                    if (next) {
                      e.preventDefault();
                      const el = e.currentTarget;
                      setText(next.text);
                      requestAnimationFrame(() =>
                        el.setSelectionRange(next.cursor, next.cursor),
                      );
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-content/60">
                    <input
                      type="checkbox"
                      checked={execute}
                      onChange={(e) => setExecute(e.target.checked)}
                    />
                    {t("Authorize the manager to execute this request")}
                  </label>
                  {running ? (
                    <>
                      <BusyIndicator label={running.member || t("Working…")} />
                      <button
                        type="button"
                        className={button}
                        onClick={() => stopGroup(group.id)}
                      >
                        {t("Stop")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      disabled={
                        !text.trim() || group.tokens >= group.tokenLimit
                      }
                      className="rounded-lg bg-accent px-4 py-2 text-sm text-black disabled:opacity-40"
                    >
                      {t("Send")}
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-content-center gap-4 text-center">
              <p className="text-content/50">
                {t("Create a team with different agents and models.")}
              </p>
              <button className={button} onClick={() => void create()}>
                {t("New group chat")}
              </button>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
