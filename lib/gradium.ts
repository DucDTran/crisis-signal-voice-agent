import { serverEnv } from '@/lib/server-env';

const GRADIUM_TTS_URL = 'https://api.gradium.ai/api/post/speech/tts';
const DEFAULT_REPORTER_VOICE = 'YTpq7expH9539ERJ';
const DEFAULT_OPERATOR_VOICE = 'LFZvm12tW_z0xfGo';

export type GradiumSpeaker = 'reporter' | 'operator' | 'field';

export function gradiumVoiceFor(speaker: GradiumSpeaker) {
  if (speaker === 'operator') {
    return (
      serverEnv('GRADIUM_OPERATOR_VOICE_ID') ?? DEFAULT_OPERATOR_VOICE
    );
  }

  return serverEnv('GRADIUM_REPORTER_VOICE_ID') ?? DEFAULT_REPORTER_VOICE;
}

export async function synthesizeGradiumPcm(
  text: string,
  voiceId: string,
) {
  const apiKey = serverEnv('GRADIUM_API_KEY');
  if (!apiKey) {
    throw new Error('Gradium speech synthesis is not configured.');
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(GRADIUM_TTS_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        output_format: 'pcm_16000',
        only_audio: true,
      }),
    });

    if (response.ok) return new Uint8Array(await response.arrayBuffer());

    const detail = (await response.text()).slice(0, 240);
    const concurrencyLimited =
      response.status === 400 && /concurrency limit/i.test(detail);
    if (!concurrencyLimited || attempt === 4) {
      throw new Error(
        `Gradium synthesis failed (${response.status})${detail ? `: ${detail}` : '.'}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
  }

  throw new Error('Gradium synthesis did not complete.');
}

export function addSilence(pcm: Uint8Array, durationMs: number) {
  const sampleCount = Math.max(0, Math.round((16_000 * durationMs) / 1000));
  const silence = new Uint8Array(sampleCount * 2);
  const combined = new Uint8Array(pcm.length + silence.length);
  combined.set(pcm);
  combined.set(silence, pcm.length);
  return combined;
}

export function pcm16ToWav(pcm: Uint8Array) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcm.length, true);

  const wav = new Uint8Array(44 + pcm.length);
  wav.set(new Uint8Array(header));
  wav.set(pcm, 44);
  return wav;
}
