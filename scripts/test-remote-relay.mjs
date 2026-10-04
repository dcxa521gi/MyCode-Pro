import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createRelay } from "./remote-relay.mjs";

async function start(t, options = {}) {
  const relay = createRelay(options),
    server = http.createServer(relay.handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    relay.close();
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, { method = "GET", value, auth } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        ...(value ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Authorization: "Bearer " + auth } : {}),
      },
      body: value ? JSON.stringify(value) : undefined,
    });
  return { call };
}
const hostKey = "11".repeat(32),
  key = Buffer.alloc(32, 34);
function seal(value, aad) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    nonce: nonce.toString("base64"),
    ciphertext: data.toString("base64"),
  };
}
function open(envelope, aad) {
  const data = Buffer.from(envelope.ciphertext, "base64"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(envelope.nonce, "base64"),
    );
  cipher.setAAD(Buffer.from(aad));
  cipher.setAuthTag(data.subarray(-16));
  return JSON.parse(
    Buffer.concat([cipher.update(data.subarray(0, -16)), cipher.final()]),
  );
}
test("registration, owner-only polling and encrypted request/reply binding", async (t) => {
  const { call } = await start(t, { registrationKey: "test-registration" });
  assert.equal(
    (await call("/v1/rooms", { method: "POST", value: { hostKey } })).status,
    401,
  );
  const registered = await call("/v1/rooms", {
    method: "POST",
    value: { hostKey },
    auth: "test-registration",
  });
  assert.equal(registered.status, 201);
  const { room } = await registered.json();
  const path = "/v1/rooms/" + room;
  assert.equal(
    (await call(path + "/poll", { auth: "wrong-owner" })).status,
    401,
  );
  assert.equal(
    (
      await call(path + "/request", {
        method: "POST",
        value: { action: "send", text: "plaintext" },
      })
    ).status,
    400,
  );
  const original = {
    action: "send",
    sessionId: "original-session",
    text: "继续任务",
    deviceToken: "test-device",
    id: "once",
  };
  const encrypted = seal(original, "mycode:request:" + room),
    received = call(path + "/request", { method: "POST", value: encrypted });
  const polled = await call(path + "/poll", { auth: hostKey });
  const { jobs } = await polled.json();
  assert.equal(jobs.length, 1);
  assert.deepEqual(open(jobs[0].envelope, "mycode:request:" + room), original);
  assert.ok(!JSON.stringify(jobs).includes("test-device"));
  const answer = seal(
    { ok: true, result: { accepted: true } },
    "mycode:response:" + room + ":" + encrypted.nonce,
  );
  answer.requestNonce = "wrong";
  assert.equal(
    (
      await call(path + "/answer", {
        method: "POST",
        value: { id: jobs[0].id, envelope: answer },
        auth: hostKey,
      })
    ).status,
    400,
  );
  answer.requestNonce = encrypted.nonce;
  assert.equal(
    (
      await call(path + "/answer", {
        method: "POST",
        value: { id: jobs[0].id, envelope: answer },
        auth: hostKey,
      })
    ).status,
    200,
  );
  const result = await (await received).json();
  assert.deepEqual(
    open(result.envelope, "mycode:response:" + room + ":" + encrypted.nonce),
    { ok: true, result: { accepted: true } },
  );
  assert.throws(() =>
    open(result.envelope, "mycode:response:wrong-room:" + encrypted.nonce),
  );
  assert.equal(
    (await call(path, { method: "DELETE", auth: "wrong-owner" })).status,
    401,
  );
  assert.equal(
    (await call(path, { method: "DELETE", auth: hostKey })).status,
    200,
  );
  assert.equal(
    (await call(path + "/request", { method: "POST", value: encrypted }))
      .status,
    410,
  );
});
test("offline deadlines and queue limits reject work instead of silently creating another task", async (t) => {
  const { call } = await start(t, { requestMs: 70, pollMs: 20, maxPending: 1 });
  const { room } = await (
    await call("/v1/rooms", { method: "POST", value: { hostKey } })
  ).json();
  const path = "/v1/rooms/" + room;
  const first = call(path + "/request", {
    method: "POST",
    value: seal({ action: "send" }, "request"),
  });
  // A host poll proves the first request has entered the queue before checking the limit.
  await call(path + "/poll", { auth: hostKey });
  assert.equal(
    (
      await call(path + "/request", {
        method: "POST",
        value: seal({ action: "send" }, "request"),
      })
    ).status,
    429,
  );
  assert.equal((await first).status, 504);
  assert.deepEqual(
    await (await call(path + "/poll", { auth: hostKey })).json(),
    { jobs: [] },
  );
});
test("expired rooms and bounded registration", async (t) => {
  let now = 1;
  const { call } = await start(t, { maxRooms: 1, ttl: 100, now: () => now });
  const { room } = await (
    await call("/v1/rooms", { method: "POST", value: { hostKey } })
  ).json();
  assert.equal(
    (await call("/v1/rooms", { method: "POST", value: { hostKey } })).status,
    429,
  );
  now = 200;
  assert.equal(
    (await call("/v1/rooms/" + room + "/poll", { auth: hostKey })).status,
    410,
  );
  assert.equal(
    (await call("/v1/rooms", { method: "POST", value: { hostKey } })).status,
    201,
  );
});
