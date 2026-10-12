import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeHostTarGzip, verifyHostTarGzip } from "./package-tar.mjs";

test("Unix packages carry real 0755 modes and both licenses even when built on Windows", async () => {
  const root = await mkdtemp(join(tmpdir(), "mycode-host-tar-"));
  try {
    await mkdir(join(root, "bin"));
    const files = [
      "bin/node",
      "LICENSE",
      "host.mjs",
      "provider-guard.mjs",
      "MONOCODE-LICENSE",
      "version.json",
      "monocode-host",
    ];
    for (const [index, name] of files.entries())
      await writeFile(
        join(root, name),
        "A".repeat([513, 511, 512, 0, 8193, 1, 1024][index]),
      );
    const filename = join(root, "host.tar.gz");
    await writeHostTarGzip(root, filename);
    const modes = await verifyHostTarGzip(filename);
    assert.equal(modes.get("bin/node"), 0o755);
    assert.equal(modes.get("monocode-host"), 0o755);
    assert.equal(modes.get("LICENSE"), 0o644);
    assert.equal(modes.get("MONOCODE-LICENSE"), 0o644);
    const packed = await readFile(filename);
    await writeFile(
      join(root, "truncated.tar.gz"),
      packed.subarray(0, packed.length - 5),
    );
    await assert.rejects(verifyHostTarGzip(join(root, "truncated.tar.gz")));
    const raw = gunzipSync(packed);
    const forged = Buffer.from(raw);
    forged.fill(0, 0, 100);
    forged.write("../outside", 0);
    forged.fill(32, 148, 156);
    const sum = forged
      .subarray(0, 512)
      .reduce((total, byte) => total + byte, 0);
    forged.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
    await writeFile(join(root, "traversal.tar.gz"), gzipSync(forged));
    await assert.rejects(
      verifyHostTarGzip(join(root, "traversal.tar.gz")),
      /filename or entry type/,
    );
    const badChecksum = Buffer.from(raw);
    badChecksum[20] ^= 1;
    await writeFile(join(root, "checksum.tar.gz"), gzipSync(badChecksum));
    await assert.rejects(
      verifyHostTarGzip(join(root, "checksum.tar.gz")),
      /checksum/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
