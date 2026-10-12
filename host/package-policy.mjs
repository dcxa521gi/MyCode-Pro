import { lstat, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

async function controlledDirectory(root, name) {
  const absoluteRoot = resolve(root);
  const directory = resolve(absoluteRoot, name);
  if (
    dirname(directory) !== absoluteRoot ||
    relative(absoluteRoot, directory) !== name
  )
    throw new Error(
      "Host package deletion must stay within its controlled directory",
    );
  if (relative(await realpath(absoluteRoot), absoluteRoot) !== "")
    throw new Error(
      "Host package output must not redirect outside its workspace",
    );
  try {
    if ((await lstat(directory)).isSymbolicLink())
      throw new Error("Host package deletion must not follow a symbolic link");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return join(absoluteRoot, name);
}

export async function packageDirectory(output, target, supportedTargets) {
  if (!supportedTargets.includes(target))
    throw new Error(`Unsupported host target: ${target}`);
  return controlledDirectory(output, target);
}

export async function runtimeDirectory(folder) {
  return controlledDirectory(folder, "runtime");
}

export function canExecutePackagedRuntime(
  target,
  platform = process.platform,
  arch = process.arch,
) {
  return target === `${platform}-${arch}`;
}
