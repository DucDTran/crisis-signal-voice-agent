import { readFile } from 'node:fs/promises';

const dashboard = await readFile(
  new URL('../components/flood-dashboard.tsx', import.meta.url),
  'utf8',
);
const analyzer = await readFile(
  new URL('../app/api/analyze-incident/route.ts', import.meta.url),
  'utf8',
);
const layout = await readFile(
  new URL('../app/layout.tsx', import.meta.url),
  'utf8',
);
const responseActions = await readFile(
  new URL('../components/response-actions.tsx', import.meta.url),
  'utf8',
);

const failures = [];

for (const [label, source, required] of [
  ['gateway retry policy', analyzer, 'MAX_GATEWAY_ATTEMPTS'],
  ['retryable gateway status handling', analyzer, 'isRetryableGatewayStatus'],
  ['global gateway request queue', analyzer, 'gatewayQueue'],
  ['retained reasoning trace type', dashboard, 'type ReasoningTrace'],
  ['reverse chronological trace retention', dashboard, 'previousTraces'],
  ['scrollable operational analysis', dashboard, 'data-analysis-scroll'],
  ['functional workspace navigation', dashboard, 'activeView'],
  ['architecture workspace', dashboard, 'ArchitectureView'],
  ['CrisisSignal branding', dashboard, 'CrisisSignal'],
  ['operations dashboard title', dashboard, 'Operations Dashboard'],
  ['DM Sans application font', layout, 'DM_Sans'],
  ['CrisisSignal page metadata', layout, 'CrisisSignal | Crisis Coordination'],
]) {
  if (!source.includes(required)) failures.push(`Missing ${label}.`);
}

if (responseActions.includes('AI proposes actions from the incident record')) {
  failures.push('Obsolete response-action helper text remains.');
}

if (layout.includes('Geist')) {
  failures.push('The application layout still imports the previous font.');
}

for (const removed of [
  'ResponseTeamsView',
  'DataSourcesView',
  'font-mono',
  'One call plays at a time',
  'Each call owns a source-linked object',
  'Model-emitted conclusions',
  'AI proposes actions from the incident record',
  'Geocoded from extracted transcript location',
  'Simulation only',
]) {
  if (dashboard.includes(removed)) {
    failures.push(`Obsolete dashboard content remains: ${removed}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Operational analysis and workspace checks passed.');
