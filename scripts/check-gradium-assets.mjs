import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const incidentsSource = await readFile(resolve(root, 'lib/incidents.ts'), 'utf8');
const routeSource = await readFile(
  resolve(root, 'app/api/gradium-conversation/route.ts'),
  'utf8',
);
const dashboardSource = await readFile(
  resolve(root, 'components/flood-dashboard.tsx'),
  'utf8',
);

const callIds = [
  ...incidentsSource.matchAll(
    /id: '((?:flood|storm|landslide)-call-\d+)'/g,
  ),
].map((match) => match[1]);
const failures = [];

if (callIds.length < 10) failures.push('scenario call IDs were not discovered');
if (/Promise\.all\(\s*turns\.map/.test(routeSource)) {
  failures.push('runtime synthesis still starts every Gradium turn concurrently');
}
if (!dashboardSource.includes('preGeneratedAudioUrl')) {
  failures.push('dashboard does not prefer pre-generated call audio');
}

for (const callId of callIds) {
  const audioPath = resolve(
    root,
    'public/audio/vinh/generated',
    `${callId}.wav`,
  );
  try {
    await access(audioPath);
    const fileStat = await stat(audioPath);
    const header = await readFile(audioPath, { encoding: null });
    if (fileStat.size <= 44 || header.subarray(0, 4).toString('ascii') !== 'RIFF') {
      failures.push(`${callId}.wav is not a valid non-empty RIFF file`);
    }
  } catch {
    failures.push(`${callId}.wav is missing`);
  }
}

if (failures.length > 0) {
  console.error('Gradium asset-pipeline check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Gradium asset-pipeline check passed for ${callIds.length} calls.`);
}
