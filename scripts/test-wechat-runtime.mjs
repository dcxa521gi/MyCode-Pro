import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const directory = await mkdtemp(path.join(tmpdir(), "mycode-wechat-test-"));
try {
  const file = path.join(directory, "wechat.cjs");
  await build({
    entryPoints: ["runtime/wechat.ts"],
    outfile: file,
    bundle: true,
    platform: "node",
    format: "cjs",
    plugins: [
      {
        name: "wechat-fixture",
        setup(b) {
          b.onResolve(
            { filter: /cindy-wechat-ilink\/src\/transport$/ },
            () => ({ path: "fixture", namespace: "test" }),
          );
          b.onLoad({ filter: /.*/, namespace: "test" }, () => ({
            loader: "js",
            contents: `
 export class TencentIlinkTransport {
 constructor(options){this.options=options;this.polled=false;}
 async beginAuthorization(){return {id:'challenge',qrCodeUrl:'https://weixin.qq.com/test',createdAt:Date.now()};}
 async waitAuthorization(challenge,signal){await new Promise(resolve=>setTimeout(resolve,20)); if(signal.aborted)throw Error('aborted');return {token:'secret-test',botId:'bot',userId:'owner',baseUrl:'https://ilinkai.weixin.qq.com'};}
 async notifyStart(){}
 async poll(cursor,signal){if(this.polled)return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));this.polled=true;return {cursor:'next',messages:[{messageId:'1',senderId:'intruder',text:'ignore',contextToken:'x'},{messageId:'2',senderId:'owner',text:'hello',contextToken:'ctx'},{messageId:'2',senderId:'owner',text:'hello',contextToken:'ctx'}]};}
 async sendMessage(input){if(input.peerId!=='owner'||input.contextToken!=='ctx')throw Error('invalid peer');}
 }`,
          }));
        },
      },
    ],
  });
  const { createWechat } = (await import(pathToFileURL(file))).default;
  const secrets = new Map();
  const host = {
    secrets: {
      read: (k) => secrets.get(k),
      write: (k, v) => secrets.set(k, v),
      remove: (k) => secrets.delete(k),
    },
  };
  const bot = createWechat(host);
  const incoming = [];
  bot.onMessage((e) => incoming.push(e));
  assert.equal(bot.getStatus().kind, "Disconnected");
  await assert.rejects(bot.init(), /Scan/);
  await bot.authorize();
  assert(bot.publicState().qrImage.startsWith("data:image/png;base64,"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(bot.publicState().ownerId, "owner");
  assert.equal(bot.publicState().token, undefined);
  await bot.init();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(incoming.length, 1);
  assert.equal(incoming[0].text, "hello");
  await bot.sendText("owner", "reply");
  await assert.rejects(bot.sendText("intruder", "reply"));
  await bot.dispose();
  await assert.rejects(bot.sendText("owner", "reply"));
  secrets.clear();
  await bot.authorize();
  await bot.dispose();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(secrets.has("wechat-credentials"), false);
  console.log(
    "PASS: WeChat QR authorization, private credential persistence, owner-only receive, deduplication, reply context and cancellation.",
  );
} finally {
  const target = path.resolve(directory);
  if (
    !target.startsWith(path.resolve(tmpdir()) + path.sep) ||
    !path.basename(target).startsWith("mycode-wechat-test-")
  )
    throw Error("Invalid test directory");
  await rm(target, { recursive: true, force: true });
}
