import type { HostStore } from "./store";
import {
  validateGroup,
  pickGroup,
  groupFingerprint,
  type ModelGroup,
  type GroupCursor,
} from "../src/features/providers/model/modelGroups";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { modelsFor } from "../src/features/sessions/model/models";
import type { RemoteProvider } from "../src/features/connections/model/protocol";
import type { Session } from "../src/features/sessions/model/session";

type Published = {
  group: ModelGroup;
  projects: string[];
  revision: string;
  cursor: GroupCursor;
};
const KEY = "mycode.shared-model-groups.v1";
export function accountRoot(): string {
  return (
    process.env.MYCODE_PROVIDER_ACCOUNTS_DIR ||
    (process.platform === "win32"
      ? join(
          process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
          "com.monocode.desktop",
          "provider-accounts",
        )
      : join(homedir(), ".monocode-host", "provider-accounts"))
  );
}
export function accountDirectory(provider: string, id: string): string {
  if (
    !["claude", "codex"].includes(provider) ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(id)
  )
    throw Error("Invalid provider account / 代理账号无效");
  const directory = join(accountRoot(), provider, id);
  if (!existsSync(directory))
    throw Error(
      "Configure this account on the execution computer first / 请先在执行电脑配置此账号",
    );
  return directory;
}
export class SharedModelGroups {
  constructor(private store: HostStore) {}
  private read(): Published[] {
    const row = this.store.db
      .prepare("SELECT value FROM metadata WHERE key=?")
      .get(KEY);
    return row ? JSON.parse(String(row.value)) : [];
  }
  private write(groups: Published[]) {
    this.store.db
      .prepare(
        "INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(KEY, JSON.stringify(groups));
  }
  publish(group: ModelGroup, projects: string[]) {
    validateGroup(group);
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(group.id) ||
      group.name.length > 200 ||
      ![
        "claude",
        "codex",
        "cursor",
        "grok",
        "opencode",
        "pi",
        "hermes",
        "devin",
        "acp",
      ].includes(group.harness) ||
      group.candidates.some(
        (c) => c.model.includes(":mycode-") || c.model.includes(":group/"),
      )
    )
      throw Error(
        "Share native models configured on the execution computer / 请共享执行电脑上已配置的原生模型",
      );
    if (!Array.isArray(projects) || !projects.length || projects.length > 128)
      throw Error(
        "Choose projects allowed to use this group / 请选择允许使用模型组的项目",
      );
    for (const id of projects) this.store.project(id);
    for (const source of group.candidates)
      if (source.accountId && source.accountId !== "default")
        accountDirectory(group.harness, source.accountId);
    const previous = this.read();
    const old = previous.find((p) => p.group.id === group.id);
    if (!old && previous.length >= 128)
      throw Error("Too many shared model groups / 共享模型组数量已达上限");
    projects = [...new Set([...(old?.projects ?? []), ...projects])].sort();
    const revision = createHash("sha256")
      .update(JSON.stringify([group, projects]))
      .digest("hex");
    const next = {
      group,
      projects,
      revision,
      cursor:
        old?.revision === revision
          ? old.cursor
          : { fingerprint: groupFingerprint(group), counters: {} },
    };
    this.write([...previous.filter((p) => p.group.id !== group.id), next]);
    return revision;
  }
  remove(id: string) {
    this.write(this.read().filter((p) => p.group.id !== id));
  }
  authorize(project: string, session: Session) {
    if (!session.modelGroupId) return;
    const entry = this.read().find(
      (p) =>
        p.group.id === session.modelGroupId &&
        p.group.harness === session.harness &&
        p.projects.includes(project),
    );
    if (
      !entry ||
      !entry.group.candidates.some(
        (c) =>
          c.enabled &&
          c.model === session.model &&
          (c.accountId || "default") ===
            (session.providerAccountId || "default"),
      )
    )
      throw Error(
        "Model group access changed; choose an available model before continuing / 模型组授权已变更，请选择可用模型后继续",
      );
    if (session.providerAccountId && session.providerAccountId !== "default")
      accountDirectory(session.harness, session.providerAccountId);
  }
  list(project: string) {
    this.store.project(project);
    return this.read()
      .filter((p) => p.projects.includes(project))
      .map((p) => ({
        id: p.group.id,
        name: p.group.name,
        harness: p.group.harness,
        revision: p.revision,
        strategy: p.group.strategy,
      }));
  }
  resolve(project: string, model: string, harness: RemoteProvider) {
    if (!model.startsWith(`${harness}:group/`)) return undefined;
    const parts = model.slice(`${harness}:group/`.length).split("/");
    const entry = this.read().find(
      (p) =>
        p.group.id === parts[0] &&
        p.revision === parts[1] &&
        p.projects.includes(project) &&
        p.group.harness === harness,
    );
    if (!entry)
      throw Error(
        "Model group was changed or access was revoked. Refresh models. / 模型组已变更或撤销授权，请刷新模型",
      );
    const catalog = modelsFor(harness);
    const facts = Object.fromEntries(
      entry.group.candidates.map((c) => {
        let available = catalog.some(
          (m) => m.id === c.model && !m.connectionId,
        );
        if (c.accountId && c.accountId !== "default") {
          try {
            accountDirectory(harness, c.accountId);
          } catch {
            available = false;
          }
        }
        return [c.id, { available, limited: false, headroom: null }];
      }),
    );
    const pick = pickGroup(entry.group, facts, entry.cursor);
    if (!pick)
      throw Error(
        "No available source in this model group / 模型组中没有可用来源",
      );
    return {
      model: pick.candidate.model,
      providerAccountId: pick.candidate.accountId,
      modelGroupId: entry.group.id,
      commit: () => {
        const rows = this.read();
        const latest = rows.find((p) => p.group.id === entry.group.id);
        if (!latest || latest.revision !== entry.revision)
          throw Error("Model group authorization changed / 模型组授权已变更");
        latest.cursor = pick.cursor;
        this.write(rows);
      },
    };
  }
}
