import { isIncidentAnalysis } from '@/lib/incidents';
import { serverEnv } from '@/lib/server-env';

type AnalyzeBody = {
  transcript?: unknown;
  callTitle?: unknown;
  previousIncident?: unknown;
};

const validActionIds = new Set([
  'notify_disaster_command',
  'dispatch_rescue_canoes',
  'dispatch_medical_team',
  'close_access_route',
  'evacuate_area',
  'dispatch_technical_team',
  'request_utility_shutdown',
  'issue_public_alert',
]);
const MAX_GATEWAY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_500;
const MIN_GATEWAY_REQUEST_INTERVAL_MS = 1_500;
let gatewayQueue: Promise<void> = Promise.resolve();
let nextGatewayRequestAt = 0;

function isRetryableGatewayStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function queuedGatewayFetch(
  apiKey: string,
  body: string,
  signal: AbortSignal,
) {
  let response: Response | undefined;
  const request = gatewayQueue
    .catch(() => undefined)
    .then(async () => {
      const wait = Math.max(0, nextGatewayRequestAt - Date.now());
      if (wait > 0) await sleep(wait);
      if (signal.aborted) {
        const error = new Error('The queued analysis request was cancelled.');
        error.name = 'AbortError';
        throw error;
      }
      response = await fetch(
        'https://llm-gateway.assemblyai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            authorization: apiKey,
            'content-type': 'application/json',
          },
          signal,
          cache: 'no-store',
          body,
        },
      );
      nextGatewayRequestAt = Date.now() + MIN_GATEWAY_REQUEST_INTERVAL_MS;
    });
  gatewayQueue = request.then(
    () => undefined,
    () => undefined,
  );
  await request;
  if (!response) throw new Error('The analysis gateway returned no response.');
  return response;
}

function displayString(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return 'Unknown';
}

function normalizeAnalysis(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const analysis = value as Record<string, unknown>;
  if (!analysis.incident || typeof analysis.incident !== 'object') return value;
  const incident = analysis.incident as Record<string, unknown>;
  const actions = Array.isArray(incident.recommendedActionIds)
    ? [
        ...new Set(
          incident.recommendedActionIds.filter(
            (actionId): actionId is string =>
              typeof actionId === 'string' && validActionIds.has(actionId),
          ),
        ),
      ].slice(0, 5)
    : [];
  const reasoningEvents = Array.isArray(analysis.reasoningEvents)
    ? analysis.reasoningEvents.slice(0, 6)
    : analysis.reasoningEvents;

  return {
    ...analysis,
    incident: {
      ...incident,
      locationName: displayString(incident.locationName),
      summary: displayString(incident.summary),
      metricLabel: displayString(incident.metricLabel),
      metricValue: displayString(incident.metricValue),
      trend: displayString(incident.trend),
      peopleAtRisk: displayString(incident.peopleAtRisk),
      injuries: displayString(incident.injuries),
      recommendedActionIds: actions,
    },
    reasoningEvents,
  };
}

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
  const callTitle =
    typeof body.callTitle === 'string'
      ? body.callTitle.trim().slice(0, 160)
      : '';
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
  const timeout = setTimeout(() => controller.abort(), 22_000);

  try {
    const gatewayBody = JSON.stringify({
      model: serverEnv('ASSEMBLYAI_LLM_MODEL') ?? 'qwen3.5-4b-32k-fast',
      temperature: 0.1,
      max_tokens: 1_450,
      messages: [
        {
          role: 'system',
          content: `You are the incident-memory agent for an emergency coordination center in Vinh City, Vietnam. Return incident data as one JSON object with exactly two top-level keys: incident and reasoningEvents. Never return a schema, markdown, or commentary. incident must contain exactly these keys: hazardType, locationId, locationName, summary, severity, confidence, metricLabel, metricValue, access, trend, peopleAtRisk, injuries, recommendedActionIds. Allowed hazardType values are flood, tropical_storm, landslide, earthquake, wildfire, building_collapse, other, unknown. Allowed locationId values are bridge, station, market, university, mountain, unknown. Map Ben Thuy Bridge 1 to bridge, Vinh Railway Station to station, Vinh Market to market, Vinh University to university, and Nui Quyet or Dung Quyet Mountain to mountain; otherwise use unknown. Allowed severity values are low, moderate, high, critical, unknown. Allowed confidence values are low, medium, high. Allowed access values are passable, restricted, impassable, unknown. recommendedActionIds may contain at most five values chosen only from notify_disaster_command, dispatch_rescue_canoes, dispatch_medical_team, close_access_route, evacuate_area, dispatch_technical_team, request_utility_shutdown, issue_public_alert. reasoningEvents must contain one to six objects with exactly kind, title, detail, evidence. Allowed kind values are observation, inference, memory_create, memory_update, uncertainty, action_proposal. Update factual memory from the cumulative transcript. Each reasoning event must be a concise, auditable conclusion with direct transcript evidence, not private chain-of-thought. The evidence field must quote or closely excerpt the transcript in no more than 18 words. Never invent measurements, casualties, responders, executed actions, or locations. Use "Unknown" for missing facts. Recommendations remain human-reviewed proposals. Rescue canoes are appropriate only for flood rescue or evacuation. Keep incident.summary under 55 words and each event detail under 40 words.`,
        },
        {
          role: 'user',
          content: `Call: ${callTitle || 'Unlabeled incoming call'}\n\nCumulative live transcript:\n${transcript}\n\nPrevious incident record, if any:\n${JSON.stringify(body.previousIncident ?? null)}`,
        },
      ],
      post_processing_steps: [{ type: 'json-repair' }],
    });
    let response: Response | undefined;
    for (let attempt = 0; attempt < MAX_GATEWAY_ATTEMPTS; attempt += 1) {
      response = await queuedGatewayFetch(
        apiKey,
        gatewayBody,
        controller.signal,
      );
      if (response.ok || !isRetryableGatewayStatus(response.status)) break;
      if (attempt < MAX_GATEWAY_ATTEMPTS - 1) {
        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }

    if (!response?.ok) {
      return Response.json(
        {
          error:
            'Operational analysis is temporarily delayed. Existing incident memory remains active.',
        },
        { status: 503 },
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

    const analysis: unknown = normalizeAnalysis(JSON.parse(content));
    if (!isIncidentAnalysis(analysis)) {
      return Response.json(
        { error: 'The incident analyzer returned an invalid result.' },
        { status: 502 },
      );
    }

    return Response.json({
      incident: {
        ...analysis.incident,
        recommendedActionIds: [
          ...new Set(
            analysis.incident.recommendedActionIds.filter(
              (actionId) =>
                actionId !== 'dispatch_rescue_canoes' ||
                analysis.incident.hazardType === 'flood',
            ),
          ),
        ],
      },
      reasoningEvents: analysis.reasoningEvents,
    });
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
