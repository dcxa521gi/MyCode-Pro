import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { afterEach, expect, it, vi } from "vitest";
import type { HarnessEvent } from "../../core/types";

let child: ChildProcessWithoutNullStreams | undefined;
let onLine: (line: string) => void;
const writes: Record<string, unknown>[] = [];
// Real subprocess transport: keep the wake result outstanding until the test
// releases it, just like a Claude background response with no turn identifier.
const fixture = `
const rl = require('node:readline').createInterface({ input: process.stdin });
const emit = value => process.stdout.write(JSON.stringify(value) + '\\n');
rl.on('line', line => {
  const msg = JSON.parse(line);
  if (msg.fixture === 'wake') emit({type:'assistant',message:{content:[{type:'text',text:'Old wake'}]}});
  else if (msg.fixture === 'finish') emit({type:'result',subtype:'success',result:'Old wake'});
  else if (msg.request?.subtype === 'initialize') emit({type:'control_response',response:{subtype:'success',request_id:msg.request_id}});
  else if (msg.type === 'user') {
    const text = msg.message.content[0].text;
    const answer = () => {
      emit({type:'assistant',message:{content:[{type:'text',text:'Answer: ' + text}]}});
      emit({type:'result',subtype:'success',result:'Answer: ' + text});
    };
    if (text === 'Too early') setTimeout(answer, 100);
    else answer();
  }
});`;
vi.mock("../../core/child", () => ({
  resolveClaudeBinary: async () => ({ path: "/fake/claude" }),
  spawnChild: async () => {
    child = spawn(process.execPath, ["-e", fixture]);
    createInterface({ input: child.stdout }).on("line", (line) => onLine(line));
  },
  watchChild: (_id: string, line: (line: string) => void) => {
    onLine = line;
  },
  unwatchChild: () => undefined,
  killChild: async () => {
    child?.kill();
  },
  writeChild: async (_id: string, line: string) => {
    writes.push(JSON.parse(line));
    child!.stdin.write(line + "\n");
  },
}));
const {
  cancelClaudeTurn,
  sendClaudeTurn,
  isClaudeSessionActive,
  stopClaudeSession,
  __claudeTestReset,
} = await import("./claude");
const events: HarnessEvent[] = [];
const input = (text: string) => ({
  sessionId: "s1",
  cwd: "/repo",
  model: "claude:claude-sonnet-5",
  modelSettings: {},
  runtimeMode: "supervised" as const,
  text,
  attachments: [],
  onEvent: (event: HarnessEvent) => events.push(event),
});
const waitFor = async (predicate: () => boolean) => {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Fixture did not reach expected state");
};
afterEach(async () => {
  await stopClaudeSession("s1");
  __claudeTestReset();
  writes.length = 0;
  events.length = 0;
});

it("rejects a new user turn while an unsolicited wake owns the subprocess result", async () => {
  await sendClaudeTurn(input("First"));
  expect(isClaudeSessionActive("s1")).toBe(false);
  child!.stdin.write(JSON.stringify({ fixture: "wake" }) + "\n");
  await waitFor(() => isClaudeSessionActive("s1"));
  const attempted = sendClaudeTurn(input("Too early")).then(
    () => "accepted",
    (error) => error.message,
  );
  // Let the old result arrive after the explicit send attempt. It must never
  // settle a new user turn or cause its real result to be lost.
  await new Promise((resolve) => setTimeout(resolve, 20));
  child!.stdin.write(JSON.stringify({ fixture: "finish" }) + "\n");
  expect(await attempted).toBe(
    "Claude is finishing a background response. Try again when it completes.",
  );
  expect(writes.filter((msg) => msg.type === "user")).toHaveLength(1);
  await waitFor(() => !isClaudeSessionActive("s1"));
  await sendClaudeTurn(input("Second"));
  expect(events).toContainEqual(
    expect.objectContaining({ type: "message.delta", text: "Answer: Second" }),
  );
  expect(writes.filter((msg) => msg.type === "user")).toHaveLength(2);
});

it("stops an interrupted provider wake before accepting a later explicit turn", async () => {
  await sendClaudeTurn(input("First"));
  child!.stdin.write(JSON.stringify({ fixture: "wake" }) + "\n");
  await waitFor(() => isClaudeSessionActive("s1"));
  const oldChild = child!;
  await cancelClaudeTurn("s1");
  await sendClaudeTurn(input("Second"));
  expect(child).not.toBe(oldChild);
  expect(oldChild.killed).toBe(true);
  expect(events).toContainEqual(
    expect.objectContaining({ type: "message.delta", text: "Answer: Second" }),
  );
});
