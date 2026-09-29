import { registerHarness, type HarnessAdapter } from "../../core/registry";
import {
  killChild,
  resolveHarnessBinary,
  spawnChild,
  unwatchChild,
  watchChild,
} from "../../core/child";
import type { SendTurnInput } from "../../core/types";
const sessions = new Map<string, string>();
const pending = new Map<string, () => void>();
async function send(input: SendTurnInput) {
  const { path } = await resolveHarnessBinary("zcode");
  const args = [
    "--prompt",
    input.text,
    "--output-format",
    "stream-json",
    "--mode",
    input.intent === "plan"
      ? "plan"
      : input.runtimeMode === "full-access"
        ? "yolo"
        : "build",
  ];
  const previous = sessions.get(input.sessionId);
  if (previous) args.push("--resume", previous);

  await new Promise<void>((resolve, reject) => {
    let result = false;
    let timer: ReturnType<typeof setTimeout>;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      pending.delete(input.sessionId);
      clearTimeout(timer);
      unwatchChild(input.sessionId);
      if (error) reject(error);
      else resolve();
    };
    pending.set(input.sessionId, () => finish());
    watchChild(
      input.sessionId,
      (line) => {
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (event.type !== "result") return;
        result = true;
        if (event.sessionId) {
          sessions.set(input.sessionId, event.sessionId);
          input.onEvent({
            type: "session.providerBound",
            providerSessionId: event.sessionId,
          });
        }
        if (typeof event.response === "string")
          input.onEvent({ type: "message.delta", text: event.response });
        if (event.usage) {
          const usage = event.usage;
          input.onEvent({
            type: "turn.metrics",
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
          });
        }
        input.onEvent({ type: "message.completed" });
      },
      (code) =>
        finish(
          code === 0 && result
            ? undefined
            : Error(
                `ZCode exited (${code}); check its CLI model configuration.`,
              ),
        ),
    );
    timer = setTimeout(() => {
      void killChild(input.sessionId);
      finish(Error("ZCode request timed out"));
    }, 30 * 60_000);
    void spawnChild(input.sessionId, path, args, input.cwd, undefined, "zcode")
      .then(() => {
        if (finished) {
          void killChild(input.sessionId);
          return;
        }
        input.onAccepted?.();
        input.onEvent({ type: "session.started" });
        if (input.runtimeMode !== "full-access")
          input.onEvent({
            type: "status",
            text: "ZCode headless mode: tools requiring interactive approval are denied by the CLI.",
          });
      })
      .catch((error) =>
        finish(error instanceof Error ? error : Error(String(error))),
      );
  });
}
async function stop(id: string) {
  pending.get(id)?.();
  await killChild(id);
}
const adapter: HarnessAdapter = {
  id: "zcode",
  live: true,
  canSteer: false,
  sendTurn: send,
  async steerTurn() {
    throw Error("Wait for the current ZCode turn to finish.");
  },
  cancelTurn: stop,
  respondApproval() {},
  stopSession: stop,
  async forgetSession(id) {
    sessions.delete(id);
    await stop(id);
  },
  bindSession(id, providerId) {
    sessions.set(id, providerId);
  },
  async runTextPrompt(input) {
    input.signal?.throwIfAborted();
    const id = crypto.randomUUID();
    let text = "";
    const abort = () => {
      void stop(id);
    };
    input.signal?.addEventListener("abort", abort, { once: true });
    try {
      await send({
        ...input,
        sessionId: id,
        model: input.model ?? "zcode:default",
        runtimeMode: "supervised",
        intent: "plan",
        text: input.prompt,
        onEvent: (event) => {
          if (event.type === "message.delta") text += event.text;
        },
      });
      return text;
    } finally {
      input.signal?.removeEventListener("abort", abort);
      sessions.delete(id);
      await stop(id);
    }
  },
};
export function ensureZcodeRegistered() {
  registerHarness(adapter);
}
