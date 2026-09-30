import { readFileSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { expect, it, vi } from "vitest";

it("hides Windows headless browser children without hiding interactive browsers", () => {
  const spawn = vi.fn();
  const childProcess = { spawn };
  const sync = vi.fn();
  vm.runInNewContext(
    readFileSync("src-tauri/src/windows-headless.cjs", "utf8"),
    {
      process: { platform: "win32" },
      require: (name: string) =>
        name === "node:child_process"
          ? childProcess
          : name === "node:path"
            ? path
            : { syncBuiltinESMExports: sync },
    },
  );
  childProcess.spawn("chrome-headless-shell.exe", [], {
    windowsHide: false,
    stdio: "pipe",
  });
  expect(spawn).toHaveBeenLastCalledWith("chrome-headless-shell.exe", [], {
    windowsHide: true,
    stdio: "pipe",
  });
  childProcess.spawn("chrome.exe", ["--headless=new"], { windowsHide: false });
  expect(spawn).toHaveBeenLastCalledWith("chrome.exe", ["--headless=new"], {
    windowsHide: true,
  });
  childProcess.spawn("chrome.exe", ["https://example.test"], {
    windowsHide: false,
  });
  expect(spawn).toHaveBeenLastCalledWith(
    "chrome.exe",
    ["https://example.test"],
    { windowsHide: false },
  );
  expect(sync).toHaveBeenCalledOnce();
});
