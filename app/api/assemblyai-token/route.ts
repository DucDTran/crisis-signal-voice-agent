import { serverEnv } from '@/lib/server-env';

export async function GET() {
  const apiKey = serverEnv('ASSEMBLYAI_API_KEY');

  if (!apiKey) {
    return Response.json(
      {
        available: false,
        error:
          'Live transcription is not configured. Use the guided exercise replay.',
      },
      { status: 503 },
    );
  }

  const tokenUrl = new URL('https://streaming.assemblyai.com/v3/token');
  tokenUrl.searchParams.set('expires_in_seconds', '60');
  tokenUrl.searchParams.set('max_session_duration_seconds', '600');

  const response = await fetch(tokenUrl, {
    headers: { Authorization: apiKey },
    cache: 'no-store',
  });

  if (!response.ok) {
    return Response.json(
      {
        available: false,
        error: 'AssemblyAI could not create a streaming token.',
      },
      { status: response.status },
    );
  }

  const { token } = (await response.json()) as { token: string };
  return Response.json({ available: true, token });
}
