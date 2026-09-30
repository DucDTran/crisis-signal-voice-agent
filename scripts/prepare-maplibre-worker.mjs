import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));

await mkdir(publicDirectory, { recursive: true });
for (const filename of [
  'maplibre-gl-worker.mjs',
  'maplibre-gl-shared.mjs',
]) {
  const source = fileURLToPath(
    new URL(`../node_modules/maplibre-gl/dist/${filename}`, import.meta.url),
  );
  const destination = fileURLToPath(
    new URL(`../public/${filename}`, import.meta.url),
  );
  await copyFile(source, destination);
}
console.log('Prepared the MapLibre module worker and shared runtime.');
