import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

// Runtime downloads live outside desktop Releases. No user data is read or moved.
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Invalid Host version');
const source = path.resolve(process.argv[2] ?? 'build/host-packages');
const folder = path.resolve(`build/mycode-host-downloads-v${version}`);
fs.mkdirSync(folder, {recursive: true});
const files = [];
for (const target of ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-arm64', 'win32-x64']) {
  const name = `MyCode-host-${target}.${target.startsWith('win32') ? 'zip' : 'tar.gz'}`;
  const candidate = fs.existsSync(path.join(source, name)) ? name : name.replace('MyCode-host-', 'monocode-host-');
  const data = fs.readFileSync(path.join(source, candidate));
  const hash = createHash('sha256').update(data).digest('hex');
  const recorded = fs.readFileSync(path.join(source, `${candidate}.sha256`), 'utf8').trim().split(/\s+/)[0];
  if (hash !== recorded) throw Error(`Host checksum mismatch: ${candidate}`);
  fs.writeFileSync(path.join(folder, name), data);
  fs.writeFileSync(path.join(folder, `${name}.sha256`), `${hash}  ${name}\n`);
  files.push({name, sha256: hash, bytes: data.length});
}
fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({product: 'MyCode Host', version, files}, null, 2) + '\n');
fs.writeFileSync(path.join(folder, 'README.md'), `# MyCode Host ${version}\n\nVersioned SSH runtime downloads. Desktop installers are published on the MyCode Releases page.\n\nArchive entry names and user data directories remain compatible with installed hosts.\n`);
const git = args => execFileSync('git', args, {cwd: folder, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
if (!fs.existsSync(path.join(folder, '.git'))) {
  git(['init', '-b', `mycode-host-v${version}`]);
  for (const setting of ['user.name', 'user.email']) git(['config', setting, execFileSync('git', ['config', setting], {encoding: 'utf8'}).trim()]);
  git(['remote', 'add', 'origin', 'https://github.com/dcxa521gi/MyCode-Pro.git']);
}
const push = () => git(['-c', 'http.proxy=http://127.0.0.1:7890', '-c', 'http.version=HTTP/1.1', '-c', 'http.postBuffer=536870912', 'push', 'origin', `HEAD:refs/heads/mycode-host-v${version}`]);
// Upload one platform at a time to avoid a single large request on unstable links.
for (const file of files) {
  git(['add', '--', file.name, `${file.name}.sha256`]);
  if (git(['diff', '--cached', '--name-only']).trim()) git(['commit', '-m', `Publish MyCode Host ${version} ${file.name}`]);
  console.log(push());
  console.log(`Uploaded ${file.name}`);
}
git(['add', '--', 'manifest.json', 'README.md']);
if (git(['diff', '--cached', '--name-only']).trim()) git(['commit', '-m', `Record MyCode Host ${version} download manifest`]);
console.log(push());
console.log(JSON.stringify({version, files, url: `https://raw.githubusercontent.com/dcxa521gi/MyCode-Pro/mycode-host-v${version}`}, null, 2));
