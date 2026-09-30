import { serverEnv } from '@/lib/server-env';

export async function GET() {
  const apiKey = serverEnv('ASSEMBLYAI_API_KEY');
  if (!apiKey) {
    return Response.json(
      { available: false, error: 'AssemblyAI Voice Agent is not configured.' },
      { status: 503 },
    );
  }

  const tokenUrl = new URL('https://agents.assemblyai.com/v1/token');
  tokenUrl.searchParams.set('expires_in_seconds', '300');
  tokenUrl.searchParams.set('max_session_duration_seconds', '900');

  try {
    const response = await fetch(tokenUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      return Response.json(
        { available: false, error: 'AssemblyAI could not create a Voice Agent token.' },
        { status: response.status },
      );
    }

    const body = (await response.json()) as { token?: string };
    if (!body.token) {
      return Response.json(
        { available: false, error: 'AssemblyAI returned no Voice Agent token.' },
        { status: 502 },
      );
    }

    return Response.json({ available: true, token: body.token });
  } catch {
    return Response.json(
      { available: false, error: 'AssemblyAI Voice Agent is unreachable.' },
      { status: 502 },
    );
  }
}
