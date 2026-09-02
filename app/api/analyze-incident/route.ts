import { isIncidentSnapshot } from '@/lib/incidents';
import { serverEnv } from '@/lib/server-env';

const hazardTypes = [
  'flood',
  'tropical_storm',
  'landslide',
  'earthquake',
  'wildfire',
  'building_collapse',
  'other',
  'unknown',
] as const;

const locationIds = [
  'bridge',
  'station',
  'market',
  'university',
  'mountain',
  'unknown',
] as const;

const actionIds = [
  'notify_disaster_command',
  'dispatch_rescue_canoes',
  'dispatch_medical_team',
  'close_access_route',
  'evacuate_area',
  'dispatch_technical_team',
  'request_utility_shutdown',
  'issue_public_alert',
] as const;

const incidentSchema = {
  type: 'object',
  properties: {
    hazardType: { type: 'string', enum: hazardTypes },
    locationId: { type: 'string', enum: locationIds },
    locationName: { type: 'string' },
    summary: { type: 'string' },
    severity: {
      type: 'string',
      enum: ['low', 'moderate', 'high', 'critical', 'unknown'],
    },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    metricLabel: { type: 'string' },
    metricValue: { type: 'string' },
    access: {
      type: 'string',
      enum: ['passable', 'restricted', 'impassable', 'unknown'],
    },
    trend: { type: 'string' },
    peopleAtRisk: { type: 'string' },
    injuries: { type: 'string' },
    recommendedActionIds: {
      type: 'array',
      items: { type: 'string', enum: actionIds },
      maxItems: 5,
    },
  },
  required: [
    'hazardType',
    'locationId',
    'locationName',
    'summary',
    'severity',
    'confidence',
    'metricLabel',
    'metricValue',
    'access',
    'trend',
    'peopleAtRisk',
    'injuries',
    'recommendedActionIds',
  ],
  additionalProperties: false,
} as const;

type AnalyzeBody = {
  transcript?: unknown;
};

export async function POST(request: Request) {
  const apiKey = serverEnv('ASSEMBLYAI_API_KEY');
  if (!apiKey) {
    return Response.json(
      { error: 'AssemblyAI live analysis is not configured.' },
      { status: 503 },
    );
  }

  let body: AnalyzeBody;
  try {
    body = (await request.json()) as AnalyzeBody;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const transcript =
    typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (transcript.length < 8) {
    return Response.json(
      { error: 'More transcript context is required.' },
      { status: 400 },
    );
  }
  if (transcript.length > 12_000) {
    return Response.json({ error: 'Transcript is too long.' }, { status: 413 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);

  try {
    const response = await fetch(
      'https://llm-gateway.assemblyai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          authorization: apiKey,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        cache: 'no-store',
        body: JSON.stringify({
          model: serverEnv('ASSEMBLYAI_LLM_MODEL') ?? 'qwen3.5-4b-32k-fast',
          temperature: 0.1,
          max_tokens: 850,
          messages: [
            {
              role: 'system',
              content: `You maintain a source-linked emergency incident record for Vinh City, Vietnam. Return only one JSON object with no markdown or commentary. The object must conform exactly to this JSON Schema: ${JSON.stringify(incidentSchema)}. Extract only facts stated in the transcript. Never invent measurements, casualties, access status, responders, or locations. Use "Unknown" when evidence is missing. Map Ben Thuy Bridge 1 to bridge, Vinh Railway Station to station, Vinh Market to market, Vinh University to university, and Nui Quyet or Dung Quyet Mountain to mountain; otherwise use unknown. Choose one primary hazard. Keep the summary under 45 words. Recommend only proportionate action IDs from the schema. Recommendations are proposals for a human operator and must never imply that an action has already happened. Rescue canoes are appropriate only for floodwater rescue or evacuation. Confidence reflects transcript evidence quality, not model confidence. Include every required property and no additional properties.`,
            },
            {
              role: 'user',
              content: `Update the incident record from this cumulative live transcript:\n\n${transcript}`,
            },
          ],
          post_processing_steps: [{ type: 'json-repair' }],
        }),
      },
    );

    if (!response.ok) {
      return Response.json(
        { error: 'AssemblyAI could not analyze this transcript turn.' },
        { status: response.status },
      );
    }

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      return Response.json(
        { error: 'The incident analyzer returned no result.' },
        { status: 502 },
      );
    }

    const incident: unknown = JSON.parse(content);
    if (!isIncidentSnapshot(incident)) {
      return Response.json(
        { error: 'The incident analyzer returned an invalid result.' },
        { status: 502 },
      );
    }

    const sanitizedIncident = {
      ...incident,
      recommendedActionIds: [
        ...new Set(
          incident.recommendedActionIds.filter(
            (actionId) =>
              actionId !== 'dispatch_rescue_canoes' ||
              incident.hazardType === 'flood',
          ),
        ),
      ],
    };

    return Response.json({ incident: sanitizedIncident });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Incident analysis timed out.'
        : 'Incident analysis failed.';
    return Response.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
