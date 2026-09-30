import { readFile } from 'node:fs/promises';

const route = await readFile(
  new URL('../app/api/geocode-location/route.ts', import.meta.url),
  'utf8',
).catch(() => '');
const dashboard = await readFile(
  new URL('../components/flood-dashboard.tsx', import.meta.url),
  'utf8',
);
const map = await readFile(
  new URL('../components/vinh-map.tsx', import.meta.url),
  'utf8',
);

const failures = [];

for (const [label, source, required] of [
  ['server-side geocoding route', route, 'nominatim.openstreetmap.org'],
  ['Vinh-bounded geocoding', route, "searchParams.set('bounded', '1')"],
  ['Vietnam country filter', route, "searchParams.set('countrycodes', 'vn')"],
  ['identifying geocoder user agent', route, "'user-agent'"],
  ['geocoder result cache', route, 'geocodeCache'],
  ['one-request-per-second throttle', route, 'MIN_REQUEST_INTERVAL_MS'],
  ['fallback OpenStreetMap geocoder', route, 'PHOTON_BASE_URL'],
  ['English place-name fallback queries', route, 'searchVariants'],
  ['client geocoding request', dashboard, "fetch('/api/geocode-location'"],
  [
    'memory-owned map coordinates',
    dashboard,
    'coordinates: geocode.coordinates',
  ],
  ['coordinate-driven marker grouping', map, 'record.coordinates'],
]) {
  if (!source.includes(required)) failures.push(`Missing ${label}.`);
}

if (map.includes('const locations = [')) {
  failures.push('Map still contains a fixed location-marker registry.');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Dynamic geocoding checks passed.');
