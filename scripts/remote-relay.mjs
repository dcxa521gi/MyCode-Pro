import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";

/** Ephemeral ciphertext transport. It has no decryption keys or conversation database. */
export function createRelay({
  registrationKey = "",
  maxRooms = 128,
  maxPending = 64,
  ttl = 30 * 60 * 1000,
  pollMs = 20000,
  requestMs = 55000,
  now = Date.now,
} = {}) {
  const rooms = new Map(),
    rates = new Map();
  let pending = 0;
  const same = (a, b) => {
    const x = Buffer.from(String(a)),
      y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
  };
  const reply = (res, status, value) => {
    if (!res.destroyed && !res.writableEnded) {
      const body = JSON.stringify(value);
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    }
  };
  const read = async (req, limit) => {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > limit) throw Error("Request too large");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  };
  const validEnvelope = (v) =>
    v &&
    typeof v.nonce === "string" &&
    /^[A-Za-z0-9+/]{16}$/.test(v.nonce) &&
    typeof v.ciphertext === "string" &&
    v.ciphertext.length >= 24 &&
    v.ciphertext.length <= 90000 &&
    /^[A-Za-z0-9+/]+=*$/.test(v.ciphertext);
  const finish = (room, id, status, value) => {
    const job = room.jobs.get(id);
    if (!job) return;
    clearTimeout(job.timer);
    room.jobs.delete(id);
    pending--;
    reply(job.res, status, value);
  };
  const remove = (id) => {
    const room = rooms.get(id);
    if (!room) return;
    for (const job of [...room.jobs.keys()])
      finish(room, job, 503, { error: "Desktop disconnected" });
    if (room.poll) reply(room.poll, 410, { error: "Room expired" });
    clearTimeout(room.pollTimer);
    rooms.delete(id);
  };
  const deliver = (room) => {
    if (!room.poll) return;
    const jobs = [...room.jobs.values()]
      .filter((j) => !j.delivered)
      .slice(0, 4);
    if (!jobs.length) return;
    for (const j of jobs) j.delivered = true;
    const res = room.poll;
    room.poll = null;
    clearTimeout(room.pollTimer);
    reply(res, 200, {
      jobs: jobs.map((j) => ({ id: j.id, envelope: j.envelope })),
    });
  };
  const clean = () => {
    for (const [id, r] of rooms) if (now() - r.active > ttl) remove(id);
    for (const [ip, r] of rates) if (now() - r.start > 60000) rates.delete(ip);
  };
  const cleanup = setInterval(clean, 30000);
  cleanup.unref();
  const handler = async (req, res) => {
    try {
      if (
        req.headers.origin ||
        (req.headers["content-type"] &&
          !req.headers["content-type"].startsWith("application/json"))
      )
        return reply(res, 400, { error: "Unsupported request" });
      const url = new URL(req.url, "http://relay.invalid");
      if (url.search || url.hash)
        return reply(res, 404, { error: "Not found" });
      if (req.method === "GET" && url.pathname === "/v1/health")
        return reply(res, 200, { ok: true, protocol: 1 });
      if (req.method === "POST" && url.pathname === "/v1/rooms") {
        if (
          registrationKey &&
          !same(req.headers.authorization, "Bearer " + registrationKey)
        )
          return reply(res, 401, { error: "Registration denied" });
        clean();
        const ip = req.socket.remoteAddress || "unknown";
        let rate = rates.get(ip);
        if (!rate || now() - rate.start > 60000) {
          rate = { start: now(), count: 0 };
          rates.set(ip, rate);
        }
        if (++rate.count > 10 || rooms.size >= maxRooms)
          return reply(res, 429, { error: "Relay registration limit" });
        const body = await read(req, 4096);
        if (!/^[a-f0-9]{64}$/.test(body.hostKey || ""))
          return reply(res, 400, { error: "Invalid host key" });
        const id = randomUUID();
        rooms.set(id, {
          hostKey: body.hostKey,
          active: now(),
          jobs: new Map(),
          poll: null,
          pollTimer: null,
        });
        return reply(res, 201, { room: id });
      }
      const match = url.pathname.match(
        /^\/v1\/rooms\/([a-f0-9-]{36})(?:\/(poll|request|answer))?$/,
      );
      if (!match) return reply(res, 404, { error: "Not found" });
      const room = rooms.get(match[1]);
      if (!room || now() - room.active > ttl) {
        remove(match[1]);
        return reply(res, 410, {
          error: "Desktop is offline. Enable a new connection.",
        });
      }
      const action = match[2];
      if (
        action !== "request" &&
        !same(req.headers.authorization, "Bearer " + room.hostKey)
      )
        return reply(res, 401, { error: "Host authorization required" });
      if (req.method === "DELETE" && !action) {
        remove(match[1]);
        return reply(res, 200, { ok: true });
      }
      if (req.method === "GET" && action === "poll") {
        room.active = now();
        if (room.poll) return reply(res, 409, { error: "Poll already active" });
        room.poll = res;
        room.pollTimer = setTimeout(() => {
          if (room.poll === res) {
            room.poll = null;
            reply(res, 200, { jobs: [] });
          }
        }, pollMs);
        res.on("close", () => {
          if (room.poll === res) {
            room.poll = null;
            clearTimeout(room.pollTimer);
          }
        });
        deliver(room);
        return;
      }
      if (req.method === "POST" && action === "request") {
        if (pending >= maxPending || room.jobs.size >= 8)
          return reply(res, 429, { error: "Relay is busy" });
        const body = await read(req, 96000);
        if (!validEnvelope(body))
          return reply(res, 400, { error: "Invalid encrypted envelope" });
        const id = randomUUID();
        pending++;
        const job = {
          id,
          envelope: body,
          res,
          delivered: false,
          timer: setTimeout(
            () => finish(room, id, 504, { error: "Desktop request timed out" }),
            requestMs,
          ),
        };
        room.jobs.set(id, job);
        res.on("close", () => {
          if (room.jobs.has(id)) {
            clearTimeout(job.timer);
            room.jobs.delete(id);
            pending--;
          }
        });
        deliver(room);
        return;
      }
      if (req.method === "POST" && action === "answer") {
        const body = await read(req, 6 * 1024 * 1024);
        const job = room.jobs.get(body.id);
        if (!job) return reply(res, 404, { error: "Request expired" });
        const e = body.envelope;
        if (
          !e ||
          e.requestNonce !== job.envelope.nonce ||
          typeof e.nonce !== "string" ||
          !/^[A-Za-z0-9+/]{16}$/.test(e.nonce) ||
          typeof e.ciphertext !== "string" ||
          e.ciphertext.length > 5600000 ||
          !/^[A-Za-z0-9+/]+=*$/.test(e.ciphertext)
        )
          return reply(res, 400, { error: "Invalid reply" });
        room.active = now();
        finish(room, body.id, 200, { envelope: e });
        return reply(res, 200, { ok: true });
      }
      reply(res, 405, { error: "Method not allowed" });
    } catch {
      reply(res, 400, { error: "Invalid request" });
    }
  };
  return {
    handler,
    close() {
      clearInterval(cleanup);
      for (const id of [...rooms.keys()]) remove(id);
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const relay = createRelay({
    registrationKey: process.env.MYCODE_RELAY_REGISTRATION_KEY || "",
  });
  const tls =
    process.env.MYCODE_RELAY_TLS_CERT && process.env.MYCODE_RELAY_TLS_KEY;
  const server = tls
    ? https.createServer(
        {
          cert: fs.readFileSync(process.env.MYCODE_RELAY_TLS_CERT),
          key: fs.readFileSync(process.env.MYCODE_RELAY_TLS_KEY),
        },
        relay.handler,
      )
    : http.createServer(relay.handler);
  server.requestTimeout = 65000;
  server.headersTimeout = 15000;
  server.maxHeadersCount = 32;
  server.listen(
    Number(process.env.PORT || 8787),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        "MyCode relay ready. Conversation payloads are encrypted; request bodies are not logged.",
      ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      relay.close();
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2000).unref();
    });
}
