import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  packageDirectory,
  runtimeDirectory,
  canExecutePackagedRuntime,
} from "./package-policy.mjs";

test("packaging permits only enumerated target directories and blocks links/traversal", async () => {
  const work = await realpath(
    await mkdtemp(join(tmpdir(), "mycode-host-package-")),
  );
  const output = join(work, "host-packages");
  const outside = join(work, "outside");
  await mkdir(output);
  await mkdir(outside);
  await writeFile(join(outside, "keep.txt"), "user data");
  try {
    assert.equal(
      await packageDirectory(output, "win32-x64", ["win32-x64"]),
      join(output, "win32-x64"),
    );
    await assert.rejects(
      packageDirectory(output, "../outside", ["../outside"]),
      /controlled directory/,
    );
    await assert.rejects(
      packageDirectory(output, "toString", ["win32-x64"]),
      /Unsupported host target/,
    );
    await symlink(
      outside,
      join(output, "win32-x64"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      packageDirectory(output, "win32-x64", ["win32-x64"]),
      /symbolic link/,
    );
    await symlink(
      outside,
      join(work, "redirected"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      packageDirectory(join(work, "redirected"), "win32-x64", ["win32-x64"]),
      /redirect outside/,
    );
    assert.equal(
      await readFile(join(outside, "keep.txt"), "utf8"),
      "user data",
    );
    const folder = join(output, "linux-x64");
    await mkdir(folder);
    assert.equal(await runtimeDirectory(folder), join(folder, "runtime"));
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

test("all six targets package without executing an unavailable foreign runtime", () => {
  const targets = [
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "win32-x64",
    "win32-arm64",
  ];
  for (const current of targets) {
    const [platform, arch] = current.split("-");
    assert.deepEqual(
      targets.filter((target) =>
        canExecutePackagedRuntime(target, platform, arch),
      ),
      [current],
    );
  }
});
