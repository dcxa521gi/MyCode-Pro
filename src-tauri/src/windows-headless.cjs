// Inherited by Node-based agents and their browser daemons. Do not change
// interactive shells or headed browsers; only suppress headless console windows.
const cp = require('node:child_process');
const path = require('node:path');
const original = cp.spawn;
cp.spawn = function (file, args, options) {
  const argv = Array.isArray(args) ? args : [];
  const opts = Array.isArray(args) ? options : args;
  const binary = path.basename(String(file)).toLowerCase();
  const headless = binary.includes('headless') ||
    (/^(chrome|chromium|msedge)(\.exe)?$/.test(binary) && argv.some(a => /^--headless(?:=|$)/.test(a)));
  if (process.platform === 'win32' && headless) {
    return original.call(this, file, argv, { ...opts, windowsHide: true });
  }
  return original.apply(this, arguments);
};
require('node:module').syncBuiltinESMExports();
