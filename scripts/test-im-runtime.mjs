import { build } from "esbuild";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(path.join(tmpdir(), "mycode-im-test-"));
const mock = `
const definitions={feishu:['feishuBot:save','feishu_bot_owner_open_id'],dingtalk:['dingtalkBot:save','dingtalk-bot-owner-user-id'],wecom:['wecomBot:set-config','wecom-owner-user-id'],telegram:['telegramBot:set-config','telegram-owner-user-id'],discord:['discordBot:set-config','discord-owner-user-id']};
function transport(channel,host){let message=()=>{};let status='idle';let owner='';const [command,key]=definitions[channel];return {
registerIpc(){host.ipc.handle(command,()=>{owner='';host.secrets.remove(key);status='connected';});},
onStatusChange(){},onMessage(fn){message=fn;},getStatus(){return {kind:status};},
async init(){owner=host.secrets.read(key);status='connected';if(!owner)throw Error('missing owner');
message({senderId:'intruder',text:'deny',speaker:{id:'intruder'}});
message({senderId:owner,text:'protected',protectedContent:true});
message({senderId:owner,text:'allowed'});
},async dispose(){status='offline';},async sendText(id,text){host.secrets.write('test_reply',JSON.stringify({channel,id,text,owner}));}
};}
export const createFeishuIM=h=>transport('feishu',h),createDingTalkIM=h=>transport('dingtalk',h),createWecomIM=h=>transport('wecom',h),createTelegramIM=h=>transport('telegram',h),createDiscordIM=h=>transport('discord',h);
`;
let child;
try {
  const bundle = path.join(directory, "bridge.cjs");
  await build({
    entryPoints: ["runtime/im-bridge.ts"],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    plugins: [
      {
        name: "fake-transports",
        setup(build) {
          build.onResolve({ filter: /vendor\/cindy-im\/src\/index$/ }, () => ({
            path: "fake",
            namespace: "mock",
          }));
          build.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
            contents: mock,
            loader: "js",
          }));
        },
      },
    ],
  });
  child = spawn(process.execPath, [bundle], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  const messages = [];
  let buffer = "";
  const pending = new Map();
  let id = 0;
  child.stdout.on("data", (data) => {
    buffer += data;
    while (buffer.includes("\n")) {
      const end = buffer.indexOf("\n");
      const event = JSON.parse(buffer.slice(0, end));
      buffer = buffer.slice(end + 1);
      messages.push(event);
      if (event.kind === "response") pending.get(event.id)?.(event);
    }
  });
  const request = (data) =>
    new Promise((resolve, reject) => {
      const key = String(++id);
      const timeout = setTimeout(() => reject(Error("bridge timeout")), 5000);
      pending.set(key, (event) => {
        clearTimeout(timeout);
        pending.delete(key);
        resolve(event);
      });
      child.stdin.write(JSON.stringify({ ...data, id: key }) + "\n");
    });
  const result = await request({ action: "bootstrap", secrets: {}, directory });
  assert.equal(result.value.length, 6);
  assert(result.value.every((bot) => !bot.running));
  assert(
    (await request({ action: "registration-begin", channel: "feishu" })).error,
  );
  assert(
    (
      await request({
        action: "reply",
        channel: "wecom",
        receipt: "unknown",
        text: "no",
      })
    ).error,
  );
  for (const channel of ["wecom", "dingtalk"]) {
    const response = await request({
      action: "configure",
      channel,
      credentials: {
        botId: "test",
        secret: "test",
        appKey: "test",
        appSecret: "test",
      },
      route: {
        ownerId: "owner",
        cwd: "/workspace",
        harness: "codex",
        model: "test-model",
      },
    });
    assert(!response.error);
    const incoming = messages.filter(
      (m) => m.kind === "message" && m.value.channel === channel,
    );
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0].value.text, "allowed");
    const reply = await request({
      action: "reply",
      channel,
      receipt: incoming[0].value.receipt,
      text: "done",
    });
    assert.equal(reply.value, true);
    const saved = messages
      .filter((m) => m.kind === "secrets" && m.value.test_reply)
      .at(-1);
    assert.deepEqual(JSON.parse(saved.value.test_reply), {
      channel,
      id: "owner",
      text: "done",
      owner: "owner",
    });
    assert(
      (
        await request({
          action: "reply",
          channel,
          receipt: incoming[0].value.receipt,
          text: "duplicate",
        })
      ).error,
    );
    const stopped = await request({ action: "stop", channel });
    assert.equal(
      stopped.value.find((b) => b.channel === channel).running,
      false,
    );
  }
  console.log(
    "PASS: IM allowlist survives credential changes; unauthorized/protected messages are rejected; replies use single-use receipts; cloud actions are rejected.",
  );
} finally {
  if (child) {
    child.stdin.end();
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
  if (
    path.dirname(path.resolve(directory)) !== path.resolve(tmpdir()) ||
    !path.basename(directory).startsWith("mycode-im-test-")
  )
    throw Error("Invalid temporary test directory");
  await rm(directory, { recursive: true, force: true });
}
