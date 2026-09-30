import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const GRADIUM_TTS_URL = 'https://api.gradium.ai/api/post/speech/tts';
const DEFAULT_REPORTER_VOICE = 'YTpq7expH9539ERJ';
const DEFAULT_OPERATOR_VOICE = 'LFZvm12tW_z0xfGo';
const SAMPLE_RATE = 16_000;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(root, 'public/audio/vinh/generated');
const force = process.argv.includes('--force');
const apiKey = process.env.GRADIUM_API_KEY;

if (!apiKey) {
  throw new Error('GRADIUM_API_KEY is required to pre-generate scenario audio.');
}

const incidentsSource = await readFile(resolve(root, 'lib/incidents.ts'), 'utf8');
const transpiled = ts.transpileModule(incidentsSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const incidentsModule = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
);
const scenarios = Object.values(incidentsModule.scenarios);
const calls = scenarios.flatMap((scenario) => scenario.calls);

await mkdir(outputDirectory, { recursive: true });

function voiceFor(speaker) {
  if (speaker === 'operator') {
    return process.env.GRADIUM_OPERATOR_VOICE_ID ?? DEFAULT_OPERATOR_VOICE;
  }
  return process.env.GRADIUM_REPORTER_VOICE_ID ?? DEFAULT_REPORTER_VOICE;
}

async function synthesizeTurn(turn) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(GRADIUM_TTS_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text: turn.text,
        voice_id: voiceFor(turn.speaker),
        output_format: 'pcm_16000',
        only_audio: true,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());

    const detail = (await response.text()).slice(0, 300);
    const concurrencyLimited =
      response.status === 400 && /concurrency limit/i.test(detail);
    if (!concurrencyLimited || attempt === 5) {
      throw new Error(
        `Gradium failed for ${turn.speaker} (${response.status}): ${detail}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
  }
  throw new Error('Gradium synthesis exhausted its retries.');
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function silence(durationMs) {
  const sampleCount = Math.round((SAMPLE_RATE * durationMs) / 1000);
  return Buffer.alloc(sampleCount * 2);
}

function pcmToWav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sampleRate: SAMPLE_RATE,
  calls: {},
};

for (const [callIndex, call] of calls.entries()) {
  const outputPath = resolve(outputDirectory, `${call.id}.wav`);
  if (!force) {
    try {
      const existing = await stat(outputPath);
      if (existing.size > 44) {
        manifest.calls[call.id] = {
          file: `${call.id}.wav`,
          bytes: existing.size,
          reused: true,
        };
        console.log(`[${callIndex + 1}/${calls.length}] Reused ${call.id}.wav`);
        continue;
      }
    } catch {
      // Generate a missing asset.
    }
  }

  console.log(
    `[${callIndex + 1}/${calls.length}] Generating ${call.id} (${call.turns.length} turns, max 2 sessions)`,
  );
  const clips = await mapWithConcurrency(call.turns, 2, synthesizeTurn);
  const parts = [];
  for (const [index, clip] of clips.entries()) {
    parts.push(clip);
    if (index < clips.length - 1) {
      parts.push(silence(call.turns[index].speaker === 'operator' ? 420 : 560));
    }
  }
  const pcm = Buffer.concat(parts);
  const wav = pcmToWav(pcm);
  await writeFile(outputPath, wav);
  manifest.calls[call.id] = {
    file: `${call.id}.wav`,
    bytes: wav.length,
    durationSeconds: Number((pcm.length / 2 / SAMPLE_RATE).toFixed(2)),
    turns: call.turns.length,
  };
}

await writeFile(
  resolve(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(
  `Generated ${calls.length} complete conversations in ${pathToFileURL(outputDirectory).pathname}`,
);
