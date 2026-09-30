import { readFile } from 'node:fs/promises';

const dashboard = await readFile(
  new URL('../components/flood-dashboard.tsx', import.meta.url),
  'utf8',
);
const streamHook = await readFile(
  new URL('../hooks/use-assemblyai-stream.ts', import.meta.url),
  'utf8',
);

const failures = [];

for (const [label, pattern] of [
  ['scripted call turns are rendered as transcript', /call\.turns\.map/],
  ['duplicate AssemblyAI live-input panel remains', /AssemblyAI live line|<LiveMicrophone/],
  ['operator suggestion panel remains', /Operator turn suggested|<LiveOperatorPrompt/],
  ['canned reasoning builder remains', /buildReasoningEntries/],
]) {
  if (pattern.test(dashboard)) failures.push(label);
}

for (const [label, pattern] of [
  ['call cards do not expose a playback toggle', /toggleFixture/],
  ['fixture streaming is not clocked by audio position', /audio\.currentTime/],
  ['fixture playback does not expose pause', /pauseFixture/],
  ['fixture playback does not expose resume', /resumeFixture/],
]) {
  if (!pattern.test(`${dashboard}\n${streamHook}`)) failures.push(label);
}

if (failures.length > 0) {
  console.error('Live-call regression check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Live-call regression check passed.');
}
