import { readFile } from 'node:fs/promises';

const dashboard = await readFile(
  new URL('../components/flood-dashboard.tsx', import.meta.url),
  'utf8',
);
const streamHook = await readFile(
  new URL('../hooks/use-assemblyai-stream.ts', import.meta.url),
  'utf8',
);
const map = await readFile(
  new URL('../components/vinh-map.tsx', import.meta.url),
  'utf8',
);

const failures = [];

for (const [label, source, forbidden] of [
  ['speaker-labelled transcript bubbles', dashboard, 'TranscriptBubble'],
  [
    'fixture speaker metadata in the stream hook',
    streamHook,
    'TranscriptSpeaker',
  ],
  ['fixture speaker sequencing', streamHook, 'options.speakers'],
  ['pre-announced memory placeholders', dashboard, 'Memory pending'],
  ['preconfigured tracked-places panel', dashboard, 'TrackedPlaces'],
  ['fixture incident titles in the dashboard', dashboard, 'call.title'],
  ['fixture priority in the call queue', dashboard, 'call.priority'],
  [
    'place-bearing exercise title in the header',
    dashboard,
    'scenario.exerciseTitle',
  ],
]) {
  if (source.includes(forbidden)) failures.push(`Still contains ${label}.`);
}

for (const [label, source, required] of [
  ['plain live transcript renderer', dashboard, 'LiveTranscriptText'],
  ['bounded transcript scrolling', dashboard, 'overscroll-contain'],
  ['generic incoming-call labels', dashboard, 'genericCallLabel'],
  ['discovered-location panel', dashboard, 'Observed incident locations'],
  ['incident records supplied to the map', map, 'incidentRecords'],
  ['map tooltip risk metadata', map, 'peopleAtRisk'],
  ['map tooltip injury metadata', map, 'injuries'],
  ['map tooltip incident summary', map, 'summary'],
]) {
  if (!source.includes(required)) failures.push(`Missing ${label}.`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Discovery-driven incident UI checks passed.');
