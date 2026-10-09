import { execChild } from "../../core/child";

export type OpenCodeModelContext = {
  connectionId?: string;
  sessionId?: string;
  model?: string;
};
export type OpenCodeV2Service = {
  url: string;
  password: string;
};

export function parseOpenCodeServiceUrl(output: string): string | null {
  for (const line of output.split("\n")) {
    const match = line
      .trim()
      .match(/^(https?:\/\/(?:127\.0\.0\.1|localhost):\d+)\/?$/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

function serviceExec(
  path: string,
  args: string[],
  cwd: string,
  context?: OpenCodeModelContext,
) {
  return context
    ? execChild(path, args, cwd, "opencode", undefined, context)
    : execChild(path, args, cwd, "opencode");
}

export async function resolveOpenCodeV2ServiceUrl(
  path: string,
  cwd: string,
  modelContext?: OpenCodeModelContext,
): Promise<string> {
  const status = await serviceExec(
    path,
    ["service", "status"],
    cwd,
    modelContext,
  ).catch(() => "");
  const existing = parseOpenCodeServiceUrl(status);
  if (existing) return existing;

  const started = await serviceExec(
    path,
    ["service", "start"],
    cwd,
    modelContext,
  ).catch((error: unknown) => {
    throw new Error(
      `Could not start the OpenCode background service: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  });
  const fromStart = parseOpenCodeServiceUrl(started);
  if (fromStart) return fromStart;

  const refreshed = await serviceExec(
    path,
    ["service", "status"],
    cwd,
    modelContext,
  );
  const url = parseOpenCodeServiceUrl(refreshed);
  if (url) return url;
  throw new Error("OpenCode background service did not report a local URL.");
}

export async function resolveOpenCodeV2Service(
  path: string,
  cwd: string,
  modelContext?: OpenCodeModelContext,
): Promise<OpenCodeV2Service> {
  if (modelContext?.sessionId) {
    await serviceExec(path, ["service", "stop"], cwd, modelContext).catch(
      (error: unknown) => {
        if (
          !/not running|no service|not found|already stopped/i.test(
            String(error),
          )
        )
          throw error;
      },
    );
  }
  const url = await resolveOpenCodeV2ServiceUrl(path, cwd, modelContext);
  const password = (
    await serviceExec(path, ["service", "get", "password"], cwd, modelContext)
  ).trim();
  if (!password) {
    throw new Error("OpenCode background service did not report a password.");
  }
  return { url, password };
}
