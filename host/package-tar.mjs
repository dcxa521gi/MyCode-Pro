import { createReadStream, createWriteStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { once } from "node:events";
import { pipeline } from "node:stream/promises";
import { createGzip, createGunzip } from "node:zlib";

const files = [
  "bin/node",
  "LICENSE",
  "host.mjs",
  "provider-guard.mjs",
  "MONOCODE-LICENSE",
  "version.json",
  "monocode-host",
];
const executables = new Set(["bin/node", "monocode-host"]);
const octal = (number, width) => {
  const value = number.toString(8);
  if (!Number.isSafeInteger(number) || number < 0 || value.length >= width)
    throw Error("Invalid host tar field");
  return value.padStart(width - 1, "0") + "\0";
};
function header(name, size, mtime, directory = false) {
  const bytes = Buffer.alloc(512);
  bytes.write(name, 0, 100, "utf8");
  bytes.write(
    octal(directory || executables.has(name) ? 0o755 : 0o644, 8),
    100,
    "ascii",
  );
  bytes.write(octal(0, 8), 108, "ascii");
  bytes.write(octal(0, 8), 116, "ascii");
  bytes.write(octal(size, 12), 124, "ascii");
  bytes.write(octal(mtime, 12), 136, "ascii");
  bytes.fill(32, 148, 156);
  bytes.write(directory ? "5" : "0", 156, "ascii");
  bytes.write("ustar\0", 257, "ascii");
  bytes.write("00", 263, "ascii");
  bytes.write("root", 265, "ascii");
  bytes.write("root", 297, "ascii");
  const checksum = bytes.reduce((sum, byte) => sum + byte, 0);
  bytes.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
  return bytes;
}

/** NTFS chmod cannot preserve Unix execute bits. Write explicit POSIX headers
 * on every build platform instead of trusting the host tar's file modes. */
export async function writeHostTarGzip(folder, destination) {
  const entries = await Promise.all(
    files.map(async (name) => {
      const metadata = await lstat(join(folder, name));
      if (!metadata.isFile() || metadata.isSymbolicLink())
        throw Error("Host archive contains an unexpected file type");
      return {
        name,
        size: metadata.size,
        mtime: Math.floor(metadata.mtimeMs / 1000),
      };
    }),
  );
  const gzip = createGzip();
  const finished = pipeline(
    gzip,
    createWriteStream(destination, { flags: "wx" }),
  );
  void finished.catch(() => {});
  const write = async (bytes) => {
    if (!gzip.write(bytes)) await once(gzip, "drain");
  };
  try {
    await write(header("bin/", 0, 0, true));
    for (const entry of entries) {
      await write(header(entry.name, entry.size, entry.mtime));
      for await (const bytes of createReadStream(join(folder, entry.name)))
        await write(bytes);
      const padding = (512 - (entry.size % 512)) % 512;
      if (padding) await write(Buffer.alloc(padding));
    }
    await write(Buffer.alloc(1024));
    gzip.end();
    await finished;
  } catch (error) {
    gzip.destroy(error);
    await finished.catch(() => {});
    throw error;
  }
}

/** Inspect metadata only; never run a foreign-platform binary. */
export async function verifyHostTarGzip(filename) {
  const source = createReadStream(filename);
  const gunzip = source.pipe(createGunzip());
  source.on("error", (error) => gunzip.destroy(error));
  let buffer = Buffer.alloc(0),
    remaining = 0,
    endBlocks = 0;
  const modes = new Map();
  for await (const chunk of gunzip) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length) {
      if (remaining) {
        const count = Math.min(buffer.length, remaining);
        remaining -= count;
        buffer = buffer.subarray(count);
        continue;
      }
      if (buffer.length < 512) break;
      const bytes = buffer.subarray(0, 512);
      buffer = buffer.subarray(512);
      if (bytes.every((byte) => byte === 0)) {
        endBlocks++;
        continue;
      }
      if (endBlocks) throw Error("Unexpected data after host tar terminator");
      const text = (start, end) =>
        bytes.subarray(start, end).toString("utf8").split("\0")[0].trim();
      const expected = parseInt(text(148, 156), 8);
      const checksum = bytes.reduce(
        (sum, byte, index) => sum + (index >= 148 && index < 156 ? 32 : byte),
        0,
      );
      if (checksum !== expected)
        throw Error("Invalid host tar header checksum");
      const name = text(0, 100).replace(/^\.\//, "");
      const type = bytes[156];
      if (
        (name !== "bin/" && !files.includes(name)) ||
        (name === "bin/" ? type !== 53 : type !== 48)
      )
        throw Error("Unexpected host tar filename or entry type");
      if (modes.has(name)) throw Error("Duplicate host tar entry");
      if (
        ![text(100, 108), text(124, 136), text(148, 156)].every((value) =>
          /^[0-7]+$/.test(value),
        )
      )
        throw Error("Invalid host tar numeric field");
      modes.set(name, parseInt(text(100, 108), 8));
      const size = parseInt(text(124, 136), 8);
      if (!Number.isSafeInteger(size) || size < 0)
        throw Error("Invalid host tar entry size");
      remaining = Math.ceil(size / 512) * 512;
    }
  }
  if (remaining || buffer.length || endBlocks < 2)
    throw Error("Truncated host tar archive");
  for (const name of executables)
    if (modes.get(name) !== 0o755)
      throw Error(`Host tar executable mode is invalid: ${name}`);
  for (const name of files)
    if (!modes.has(name))
      throw Error(`Host tar is missing required file: ${name}`);
  return modes;
}
