import { gradiumVoiceFor, synthesizeGradiumPcm, pcm16ToWav, type GradiumSpeaker } from '@/lib/gradium';

type TtsBody = {
  text?: unknown;
  speaker?: unknown;
};

export async function POST(request: Request) {
  let body: TtsBody;
  try {
    body = (await request.json()) as TtsBody;
  } catch {
    return Response.json({ error: 'Invalid speech request.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const speaker: GradiumSpeaker =
    body.speaker === 'operator' || body.speaker === 'field'
      ? body.speaker
      : 'reporter';

  if (!text || text.length > 2_000) {
    return Response.json(
      { error: 'Speech text must be between 1 and 2,000 characters.' },
      { status: 400 },
    );
  }

  try {
    const pcm = await synthesizeGradiumPcm(text, gradiumVoiceFor(speaker));
    return new Response(pcm16ToWav(pcm), {
      headers: {
        'content-type': 'audio/wav',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Speech synthesis failed.';
    return Response.json({ error: message }, { status: 502 });
  }
}
