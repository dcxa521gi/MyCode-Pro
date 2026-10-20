import fs from 'node:fs';

// Feed this guard the GitHub release JSON before and after publishing.
const release = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const version = release.tag_name?.replace(/^v/, '');
if (!/^\d+\.\d+\.\d+(?:[-.][\w.-]+)?$/.test(version ?? '')) throw Error('Invalid release version');
if (!release.name?.startsWith('MyCode ')) throw Error('Release title must use MyCode branding');
if (/monocode|cindy|synara|monocode-host/i.test(release.body ?? '')) throw Error('Release description must describe MyCode only; keep source attribution in repository documentation');
const mobileName = `MyCode_${version}_Android.apk`;
const mobileChecksum = `SHA256SUMS-Android-${version}.txt`;
const allowed = new Set([`MyCode_${version}_x64-setup.exe`, mobileName, mobileChecksum, 'SHA256SUMS.txt', `verification-${version}.json`]);
const [major, minor, patch] = version.split(/[.-]/, 3).map(Number);
const requiresMobile = major > 0 || minor > 23 || (minor === 23 && patch >= 5);
for (const asset of release.assets ?? []) {
  if (!allowed.has(asset.name)) throw Error(`Unexpected desktop release asset: ${asset.name}`);
  if (asset.size <= 0) throw Error(`Empty release asset: ${asset.name}`);
}
for (const name of [`MyCode_${version}_x64-setup.exe`, 'SHA256SUMS.txt', ...(requiresMobile ? [mobileName, mobileChecksum] : [])]) {
  if (!release.assets?.some(asset => asset.name === name)) throw Error(`Required asset missing: ${name}`);
}
console.log(`MyCode ${version}: release description and ${release.assets.length} uploaded assets comply with publishing policy.`);
