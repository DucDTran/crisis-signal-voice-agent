'use client';

import {
  Activity,
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  ChevronRight,
  Database,
  Headphones,
  Layers3,
  LoaderCircle,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Volume2,
  Waves,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ResponseActions } from '@/components/response-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VinhMap, type MapIncidentRecord } from '@/components/vinh-map';
import {
  useAssemblyAIStream,
  type TranscriptTurn,
} from '@/hooks/use-assemblyai-stream';
import { useGradiumTts } from '@/hooks/use-gradium-tts';
import {
  hazardLabels,
  isIncidentAnalysis,
  scenarios,
  type ActionId,
  type IncidentSnapshot,
  type ReasoningEvent,
  type ScenarioCall,
  type ScenarioId,
} from '@/lib/incidents';

type CallStatus =
  | 'queued'
  | 'generating'
  | 'connecting'
  | 'playing'
  | 'paused'
  | 'analyzing'
  | 'processed'
  | 'error';
type AnalysisState = 'idle' | 'analyzing' | 'ready' | 'error';
type ActionStatuses = Partial<Record<ActionId, 'dispatched'>>;
type WorkspaceView = 'operations' | 'architecture';

type ReasoningTrace = ReasoningEvent & {
  id: string;
  createdAt: number;
  transcriptTurnCount: number;
};

type CallSession = {
  status: CallStatus;
  transcriptTurns: TranscriptTurn[];
  partialTranscript: string;
  currentTime: number;
  duration: number;
  error: string;
};

type IncidentMemory = {
  callId: string;
  callLabel: string;
  updatedAt: number;
  incident: IncidentSnapshot;
  coordinates: [number, number] | null;
  geocodedName: string | null;
};

type GeocodeResponse = {
  available?: boolean;
  coordinates?: [number, number];
  displayName?: string;
};

const EMPTY_SESSION: CallSession = {
  status: 'queued',
  transcriptTurns: [],
  partialTranscript: '',
  currentTime: 0,
  duration: 0,
  error: '',
};

const EMPTY_INCIDENT: IncidentSnapshot = {
  hazardType: 'unknown',
  locationId: 'unknown',
  locationName: 'Location not established',
  summary: 'No incident evidence has been extracted yet.',
  severity: 'unknown',
  confidence: 'low',
  metricLabel: 'Field measurement',
  metricValue: 'Unknown',
  access: 'unknown',
  trend: 'Unknown',
  peopleAtRisk: 'Unknown',
  injuries: 'Unknown',
  recommendedActionIds: [],
};

const navItems = [
  { id: 'operations', label: 'Operations', icon: Activity },
  { id: 'architecture', label: 'Architecture', icon: Layers3 },
] satisfies Array<{
  id: WorkspaceView;
  label: string;
  icon: typeof Activity;
}>;

function preGeneratedAudioUrl(callId: string) {
  return `/audio/vinh/generated/${callId}.wav`;
}

function genericCallLabel(call: ScenarioCall, index: number) {
  const fieldChannel = call.source.toLowerCase().includes('field');
  return `${fieldChannel ? 'Field channel' : 'Incoming call'} ${String(index + 1).padStart(2, '0')}`;
}

export function FloodDashboard() {
  const [activeView, setActiveView] = useState<WorkspaceView>('operations');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('flood');
  const [selectedCallId, setSelectedCallId] = useState('flood-call-01');
  const [sessions, setSessions] = useState<Record<string, CallSession>>({});
  const [incidentMemories, setIncidentMemories] = useState<
    Record<string, IncidentMemory>
  >({});
  const [reasoningByCall, setReasoningByCall] = useState<
    Record<string, ReasoningTrace[]>
  >({});
  const [analysisByCall, setAnalysisByCall] = useState<
    Record<string, AnalysisState>
  >({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>(
    {},
  );
  const [actionStatuses, setActionStatuses] = useState<ActionStatuses>({});
  const generatedAudioUrls = useRef<Record<string, string>>({});
  const lastAnalyzedTurnCount = useRef<Record<string, number>>({});
  const lastAnalysisStartedAt = useRef<Record<string, number>>({});
  const lastGeocodeLocation = useRef<Record<string, string>>({});
  const stream = useAssemblyAIStream();
  const gradiumTts = useGradiumTts();

  const scenario = scenarios[scenarioId];
  const calls = scenario.calls;
  const selectedCall =
    calls.find((call) => call.id === selectedCallId) ?? calls[0];
  const selectedSession = selectedCall
    ? (sessions[selectedCall.id] ?? EMPTY_SESSION)
    : EMPTY_SESSION;
  const selectedMemory = selectedCall
    ? incidentMemories[selectedCall.id]
    : undefined;
  const selectedReasoning = selectedCall
    ? (reasoningByCall[selectedCall.id] ?? [])
    : [];
  const selectedAnalysisState = selectedCall
    ? (analysisByCall[selectedCall.id] ?? 'idle')
    : 'idle';
  const selectedAnalysisError = selectedCall
    ? (analysisErrors[selectedCall.id] ?? '')
    : '';

  const memoryList = useMemo(
    () =>
      Object.values(incidentMemories).sort(
        (left, right) => right.updatedAt - left.updatedAt,
      ),
    [incidentMemories],
  );
  const displayedIncident = selectedMemory?.incident ?? EMPTY_INCIDENT;
  const mapIncidentRecords = useMemo<MapIncidentRecord[]>(
    () =>
      memoryList.map((memory) => ({
        id: memory.callId,
        source: memory.callLabel,
        coordinates: memory.coordinates,
        geocodedName: memory.geocodedName,
        ...memory.incident,
      })),
    [memoryList],
  );
  const mapStatus = selectedMemory
    ? selectedMemory.incident.confidence === 'high'
      ? 'verified'
      : 'reported'
    : 'idle';

  const selectCall = useCallback((call: ScenarioCall) => {
    setSelectedCallId(call.id);
  }, []);

  const persistActiveStream = useCallback(() => {
    const callId = stream.activeCallId;
    if (!callId) return;
    setSessions((current) => ({
      ...current,
      [callId]: {
        status:
          stream.playbackState === 'playing'
            ? 'playing'
            : stream.playbackState === 'paused'
              ? 'paused'
              : stream.playbackState === 'ended'
                ? analysisByCall[callId] === 'analyzing'
                  ? 'analyzing'
                  : 'processed'
                : stream.state === 'connecting'
                  ? 'connecting'
                  : stream.state === 'error'
                    ? 'error'
                    : (current[callId]?.status ?? 'queued'),
        transcriptTurns: stream.transcriptTurns,
        partialTranscript: stream.partialTranscript,
        currentTime: stream.currentTime,
        duration: stream.duration,
        error: stream.error,
      },
    }));
  }, [
    analysisByCall,
    stream.activeCallId,
    stream.currentTime,
    stream.duration,
    stream.error,
    stream.partialTranscript,
    stream.playbackState,
    stream.state,
    stream.transcriptTurns,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(persistActiveStream, 0);
    return () => window.clearTimeout(timer);
  }, [persistActiveStream]);

  const startOrToggleCall = useCallback(
    async (call: ScenarioCall) => {
      selectCall(call);
      const session = sessions[call.id] ?? EMPTY_SESSION;

      if (
        stream.activeCallId === call.id &&
        (stream.playbackState === 'playing' ||
          stream.playbackState === 'paused')
      ) {
        await stream.toggleFixture();
        return;
      }

      if (stream.activeCallId && stream.activeCallId !== call.id) {
        persistActiveStream();
        setSessions((current) => ({
          ...current,
          [stream.activeCallId as string]: {
            ...(current[stream.activeCallId as string] ?? EMPTY_SESSION),
            status: 'paused',
          },
        }));
      }

      const restarting =
        session.status === 'processed' ||
        session.currentTime >= session.duration;
      setSessions((current) => ({
        ...current,
        [call.id]: {
          ...(current[call.id] ?? EMPTY_SESSION),
          status: 'connecting',
          error: '',
          ...(restarting
            ? {
                transcriptTurns: [],
                partialTranscript: '',
                currentTime: 0,
              }
            : {}),
        },
      }));

      try {
        let audioUrl = generatedAudioUrls.current[call.id];
        if (!audioUrl) {
          const staticUrl = preGeneratedAudioUrl(call.id);
          const staticResponse = await fetch(staticUrl, {
            method: 'HEAD',
            cache: 'no-store',
          });
          if (staticResponse.ok) {
            audioUrl = staticUrl;
          } else {
            setSessions((current) => ({
              ...current,
              [call.id]: {
                ...(current[call.id] ?? EMPTY_SESSION),
                status: 'generating',
                error: '',
              },
            }));
            const response = await fetch('/api/gradium-conversation', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ turns: call.turns }),
            });
            if (!response.ok) {
              const body = (await response.json().catch(() => ({}))) as {
                error?: string;
              };
              throw new Error(
                body.error ?? 'Gradium could not generate this synthetic call.',
              );
            }
            audioUrl = URL.createObjectURL(await response.blob());
          }
          generatedAudioUrls.current[call.id] = audioUrl;
        }

        const initialTurns = restarting ? [] : session.transcriptTurns;
        await stream.startFixture(audioUrl, {
          callId: call.id,
          initialTurns,
          startAt: restarting ? 0 : session.currentTime,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'The synthetic call could not be prepared.';
        setSessions({
          ...sessions,
          [call.id]: {
            ...(sessions[call.id] ?? EMPTY_SESSION),
            status: 'error',
            error: errorMessage,
          },
        });
      }
    },
    [persistActiveStream, selectCall, sessions, stream],
  );

  useEffect(() => {
    const callId = stream.activeCallId;
    if (!callId || stream.finalTurns.length === 0) return;
    const turnCount = stream.finalTurns.length;
    if (lastAnalyzedTurnCount.current[callId] >= turnCount) return;
    lastAnalyzedTurnCount.current[callId] = turnCount;
    const sourceScenario = Object.values(scenarios).find((item) =>
      item.calls.some((call) => call.id === callId),
    );
    const call = sourceScenario?.calls.find((item) => item.id === callId);
    if (!call) return;
    const callLabel = genericCallLabel(
      call,
      sourceScenario?.calls.indexOf(call) ?? 0,
    );

    const transcript = stream.finalTranscript.trim();
    if (transcript.length < 8) return;
    const controller = new AbortController();
    const elapsed = Date.now() - (lastAnalysisStartedAt.current[callId] ?? 0);
    const analysisDelay = Math.max(900, 4_500 - elapsed);
    const timer = window.setTimeout(() => {
      lastAnalysisStartedAt.current[callId] = Date.now();
      setAnalysisByCall((current) => ({ ...current, [callId]: 'analyzing' }));
      setAnalysisErrors((current) => ({ ...current, [callId]: '' }));

      void fetch('/api/analyze-incident', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          transcript,
          callTitle: callLabel,
          previousIncident: incidentMemories[callId]?.incident ?? null,
        }),
      })
        .then(async (response) => {
          const body: unknown = await response.json();
          if (!response.ok || !isIncidentAnalysis(body)) {
            const errorBody = body as { error?: string };
            throw new Error(
              errorBody.error ?? 'The incident analysis was not valid.',
            );
          }
          setIncidentMemories((current) => ({
            ...current,
            [callId]: {
              callId,
              callLabel,
              updatedAt: Date.now(),
              incident: body.incident,
              coordinates:
                current[callId]?.incident.locationName ===
                body.incident.locationName
                  ? current[callId].coordinates
                  : null,
              geocodedName:
                current[callId]?.incident.locationName ===
                body.incident.locationName
                  ? current[callId].geocodedName
                  : null,
            },
          }));
          const createdAt = Date.now();
          setReasoningByCall((current) => {
            const previousTraces = current[callId] ?? [];
            const latestTraces = [...body.reasoningEvents]
              .reverse()
              .map((event, index) => ({
                ...event,
                id: `${callId}-${turnCount}-${createdAt}-${index}`,
                createdAt,
                transcriptTurnCount: turnCount,
              }));
            return {
              ...current,
              [callId]: [...latestTraces, ...previousTraces],
            };
          });
          setAnalysisByCall((current) => ({ ...current, [callId]: 'ready' }));

          const locationName = body.incident.locationName.trim();
          if (
            locationName &&
            !/^(unknown|location not established|not established)$/i.test(
              locationName,
            ) &&
            lastGeocodeLocation.current[callId] !== locationName
          ) {
            lastGeocodeLocation.current[callId] = locationName;
            void fetch('/api/geocode-location', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ location: locationName }),
            })
              .then(async (geocodeResponse) => {
                const geocode =
                  (await geocodeResponse.json()) as GeocodeResponse;
                if (
                  !geocodeResponse.ok ||
                  !geocode.available ||
                  !geocode.coordinates
                ) {
                  return;
                }
                setIncidentMemories((current) => {
                  const memory = current[callId];
                  if (
                    !memory ||
                    memory.incident.locationName !== locationName
                  ) {
                    return current;
                  }
                  return {
                    ...current,
                    [callId]: {
                      ...memory,
                      coordinates: geocode.coordinates ?? null,
                      geocodedName: geocode.displayName ?? locationName,
                    },
                  };
                });
              })
              .catch(() => undefined);
          }
        })
        .catch((error) => {
          if (error instanceof Error && error.name === 'AbortError') return;
          setAnalysisByCall((current) => ({
            ...current,
            [callId]: incidentMemories[callId] ? 'ready' : 'error',
          }));
          setAnalysisErrors((current) => ({
            ...current,
            [callId]:
              error instanceof Error
                ? error.message
                : 'Operational analysis is temporarily delayed. Existing incident memory remains active.',
          }));
        });
    }, analysisDelay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    incidentMemories,
    stream.activeCallId,
    stream.finalTranscript,
    stream.finalTurns.length,
  ]);

  const changeScenario = useCallback(
    (nextScenarioId: ScenarioId) => {
      persistActiveStream();
      stream.stop();
      const nextScenario = scenarios[nextScenarioId];
      setScenarioId(nextScenarioId);
      setSelectedCallId(nextScenario.calls[0]?.id ?? '');
      setActionStatuses({});
    },
    [persistActiveStream, stream],
  );

  const resetExercise = useCallback(() => {
    stream.reset();
    for (const url of Object.values(generatedAudioUrls.current)) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
    generatedAudioUrls.current = {};
    lastAnalyzedTurnCount.current = {};
    lastAnalysisStartedAt.current = {};
    lastGeocodeLocation.current = {};
    setSessions({});
    setIncidentMemories({});
    setReasoningByCall({});
    setAnalysisByCall({});
    setAnalysisErrors({});
    setActionStatuses({});
    setSelectedCallId(calls[0]?.id ?? '');
  }, [calls, stream]);

  useEffect(
    () => () => {
      for (const url of Object.values(generatedAudioUrls.current)) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
    },
    [],
  );

  const briefingText = selectedMemory
    ? `${selectedMemory.incident.locationName}. ${selectedMemory.incident.summary} Access is ${selectedMemory.incident.access}. People at risk: ${selectedMemory.incident.peopleAtRisk}. Injuries: ${selectedMemory.incident.injuries}.`
    : '';

  return (
    <div className="crisis-dashboard min-h-screen bg-[#0c1214] text-[#e7ecea]">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="lg:pl-[216px]">
        <Header
          scenarioId={scenarioId}
          activeView={activeView}
          onScenarioChange={changeScenario}
          onViewChange={setActiveView}
          onReset={resetExercise}
        />

        <main className="mx-auto max-w-[1800px] p-3 sm:p-4 lg:p-5">
          {activeView === 'operations' && (
            <>
              <section className="grid items-start gap-3 xl:grid-cols-[minmax(0,1.18fr)_minmax(440px,0.82fr)]">
                <MapPanel
                  selectedMemory={selectedMemory}
                  displayedIncident={displayedIncident}
                  incidentRecords={mapIncidentRecords}
                  mapStatus={mapStatus}
                />
                <CallWorkspace
                  calls={calls}
                  selectedCall={selectedCall}
                  sessions={sessions}
                  activeCallId={stream.activeCallId}
                  playbackState={stream.playbackState}
                  onSelect={selectCall}
                  onToggle={(call) => void startOrToggleCall(call)}
                  selectedSession={selectedSession}
                  analysisState={selectedAnalysisState}
                />
              </section>

              <ObservedLocations
                memories={memoryList}
                selectedCallId={selectedCall?.id ?? ''}
                onSelectCall={(callId) => {
                  const call = calls.find((item) => item.id === callId);
                  if (call) selectCall(call);
                }}
              />

              <IncidentMemoryGrid
                memories={memoryList}
                selectedCallId={selectedCall?.id ?? ''}
                onSelectCall={(callId) => {
                  const call = calls.find((item) => item.id === callId);
                  if (call) selectCall(call);
                }}
              />

              <section className="mt-3 grid gap-3 xl:grid-cols-[1.15fr_0.85fr_0.9fr]">
                <ReasoningTrail
                  callLabel={
                    selectedCall
                      ? genericCallLabel(
                          selectedCall,
                          Math.max(0, calls.indexOf(selectedCall)),
                        )
                      : undefined
                  }
                  events={selectedReasoning}
                  state={selectedAnalysisState}
                  error={selectedAnalysisError}
                />
                <BriefingPanel
                  memory={selectedMemory}
                  text={briefingText}
                  speaking={gradiumTts.state === 'loading'}
                  error={gradiumTts.error}
                  onSpeak={() => {
                    if (briefingText)
                      void gradiumTts.speak(briefingText, 'operator');
                  }}
                />
                {selectedMemory ? (
                  <ResponseActions
                    incident={selectedMemory.incident}
                    statuses={actionStatuses}
                    onDispatch={(actionId) =>
                      setActionStatuses((current) => ({
                        ...current,
                        [actionId]: 'dispatched',
                      }))
                    }
                  />
                ) : (
                  <AwaitingActions />
                )}
              </section>
            </>
          )}

          {activeView === 'architecture' && <ArchitectureView />}
        </main>
      </div>
    </div>
  );
}

function Sidebar({
  activeView,
  onViewChange,
}: {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[216px] border-r border-white/7 bg-[#101719] lg:flex lg:flex-col">
      <div className="flex h-[68px] items-center gap-3 border-b border-white/7 px-5">
        <div className="grid size-8 place-items-center rounded-md border border-[#d79b39]/30 bg-[#d79b39]/10 text-[#e1ab52]">
          <Waves className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">CrisisSignal</p>
          <p className="text-xs uppercase tracking-[0.12em] text-[#667773]">
            Crisis coordination
          </p>
        </div>
      </div>
      <nav className="space-y-1 p-3" aria-label="Primary navigation">
        {navItems.map(({ id, label, icon: Icon }) => {
          const active = id === activeView;
          return (
            <button
              key={id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onViewChange(id)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-xs transition-colors ${
                active
                  ? 'bg-white/[0.055] text-[#e1e7e5]'
                  : 'text-[#748580] hover:bg-white/[0.035] hover:text-[#aebbb7]'
              }`}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function ArchitectureView() {
  const stages = [
    {
      step: '01',
      title: 'Synthetic crisis calls',
      icon: Volume2,
      accent: 'text-[#d8a556]',
      border: 'border-[#d79b39]/24',
      detail:
        'Gradium generates complete, natural two-voice operator and reporter conversations as prepared WAV audio.',
    },
    {
      step: '02',
      title: 'Live speech recognition',
      icon: AudioLines,
      accent: 'text-[#73c8aa]',
      border: 'border-[#4dbb91]/24',
      detail:
        'Playback-clocked PCM audio is streamed to AssemblyAI Universal-3 Pro for partial and finalized transcription.',
    },
    {
      step: '03',
      title: 'Operational analysis',
      icon: Sparkles,
      accent: 'text-[#aaa0dd]',
      border: 'border-[#7766ba]/26',
      detail:
        'AssemblyAI LLM Gateway converts cumulative finalized speech into source-linked memory and auditable analysis events.',
    },
    {
      step: '04',
      title: 'Crisis coordination',
      icon: Activity,
      accent: 'text-[#df927f]',
      border: 'border-[#dd644c]/24',
      detail:
        'The dashboard updates the map, incident cards, command briefing, and human-reviewed response proposals.',
    },
  ];

  return (
    <section className="overflow-hidden rounded-md border border-white/8 bg-[#11191b]">
      <div className="border-b border-white/8 px-5 py-5">
        <div className="flex items-center gap-2">
          <Layers3 className="size-4 text-[#d79b39]" aria-hidden="true" />
          <h1 className="text-base font-semibold">System architecture</h1>
        </div>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#7f8f8b]">
          CrisisSignal turns natural synthetic conversations into a live,
          evidence-linked operational picture without exposing provider keys to
          the browser.
        </p>
      </div>

      <div className="grid gap-3 p-5 lg:grid-cols-4">
        {stages.map(({ step, title, icon: Icon, accent, border }, index) => (
          <div key={step} className="relative">
            <article
              className={`h-full rounded-md border bg-[#0c1416] p-4 ${border}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.12em] text-[#667773]">
                  {step}
                </span>
                <Icon className={`size-5 ${accent}`} aria-hidden="true" />
              </div>
              <h2 className="mt-7 text-xs font-semibold">{title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#84938f]">
                {stages[index].detail}
              </p>
            </article>
            {index < stages.length - 1 && (
              <span
                className="absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-[#11191b] text-xs text-[#7d8c88] lg:grid"
                aria-hidden="true"
              >
                →
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-px border-t border-white/8 bg-white/8 md:grid-cols-3">
        <ArchitectureBranch
          icon={MapPin}
          title="Location intelligence"
          detail="Nominatim and Photon resolve extracted Vinh place names; MapLibre renders pins and incident metadata."
        />
        <ArchitectureBranch
          icon={Database}
          title="Session memory"
          detail="Each call retains its transcript, structured incident object, geocoded location, and full analysis trace."
        />
        <ArchitectureBranch
          icon={ShieldCheck}
          title="Human control"
          detail="The model proposes follow-up actions, but every simulated dispatch requires explicit operator authorization."
        />
      </div>
    </section>
  );
}

function ArchitectureBranch({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Activity;
  title: string;
  detail: string;
}) {
  return (
    <article className="bg-[#0f1719] p-5">
      <Icon className="size-4 text-[#75a8c4]" aria-hidden="true" />
      <h2 className="mt-3 text-xs font-semibold">{title}</h2>
      <p className="mt-2 text-xs leading-relaxed text-[#758580]">{detail}</p>
    </article>
  );
}

function Header({
  scenarioId,
  activeView,
  onScenarioChange,
  onViewChange,
  onReset,
}: {
  scenarioId: ScenarioId;
  activeView: WorkspaceView;
  onScenarioChange: (scenarioId: ScenarioId) => void;
  onViewChange: (view: WorkspaceView) => void;
  onReset: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/7 bg-[#0c1214]/94 uppercase backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 px-4 py-3 lg:px-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-[0.06em]">
            Operations Dashboard
          </h1>
        </div>
        <Badge className="hidden border-[#4dbb91]/20 bg-[#4dbb91]/8 text-xs text-[#78c9aa] sm:flex">
          GRADIUM → ASSEMBLYAI STT → LLM GATEWAY
        </Badge>
        <Select
          value={scenarioId}
          onValueChange={(value) => onScenarioChange(value as ScenarioId)}
        >
          <SelectTrigger className="h-9 w-[178px] border-white/10 bg-[#121a1c] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(scenarios).map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.shortName} exercise
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="border-white/10 bg-white/[0.025] text-[#9dadA8]"
          onClick={onReset}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Reset
        </Button>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto border-t border-white/7 px-3 py-2 lg:hidden"
        aria-label="Workspace views"
      >
        {navItems.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-current={activeView === id ? 'page' : undefined}
            onClick={() => onViewChange(id)}
            className={`shrink-0 rounded px-2.5 py-1.5 text-xs ${
              activeView === id
                ? 'bg-white/[0.07] text-[#dbe3e0]'
                : 'text-[#73837f]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

function MapPanel({
  selectedMemory,
  displayedIncident,
  incidentRecords,
  mapStatus,
}: {
  selectedMemory: IncidentMemory | undefined;
  displayedIncident: IncidentSnapshot;
  incidentRecords: MapIncidentRecord[];
  mapStatus: 'idle' | 'reported' | 'verified';
}) {
  return (
    <section className="flex h-[680px] min-h-0 flex-col overflow-hidden rounded-md border border-white/8 bg-[#11191b]">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5 text-[#d79b39]" aria-hidden="true" />
            <h2 className="text-xs font-semibold">Incident Map</h2>
          </div>
        </div>
        <Badge className="ml-auto border-[#3b91aa]/20 bg-[#3b91aa]/8 text-[8px] text-[#8dc6d4]">
          {selectedMemory
            ? `${hazardLabels[displayedIncident.hazardType]} · ${displayedIncident.metricValue}`
            : 'Awaiting call evidence'}
        </Badge>
      </div>
      <div className="relative min-h-[470px] flex-1">
        <VinhMap
          status={mapStatus}
          hazardType={displayedIncident.hazardType}
          metricLabel={displayedIncident.metricLabel}
          metricValue={selectedMemory ? displayedIncident.metricValue : null}
          incidentCoordinates={selectedMemory?.coordinates ?? null}
          incidentRecords={incidentRecords}
          evidenceMode="live"
        />
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-white/8 bg-white/8 sm:grid-cols-4">
        <Metric
          label="Hazard"
          value={
            selectedMemory
              ? hazardLabels[displayedIncident.hazardType]
              : 'Not established'
          }
        />
        <Metric
          label={displayedIncident.metricLabel}
          value={
            selectedMemory ? displayedIncident.metricValue : 'Awaiting STT'
          }
        />
        <Metric
          label="Access"
          value={
            selectedMemory
              ? titleCase(displayedIncident.access)
              : 'Not established'
          }
        />
        <Metric
          label="People at risk"
          value={selectedMemory ? displayedIncident.peopleAtRisk : 'Unknown'}
        />
      </div>
    </section>
  );
}

function CallWorkspace({
  calls,
  selectedCall,
  sessions,
  activeCallId,
  playbackState,
  onSelect,
  onToggle,
  selectedSession,
  analysisState,
}: {
  calls: ScenarioCall[];
  selectedCall: ScenarioCall | undefined;
  sessions: Record<string, CallSession>;
  activeCallId: string | null;
  playbackState: string;
  onSelect: (call: ScenarioCall) => void;
  onToggle: (call: ScenarioCall) => void;
  selectedSession: CallSession;
  analysisState: AnalysisState;
}) {
  return (
    <section className="flex h-[680px] min-h-0 flex-col overflow-hidden rounded-md border border-white/8 bg-[#11191b]">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <Headphones className="size-3.5 text-[#65c9a3]" aria-hidden="true" />
          <h2 className="text-xs font-semibold">Incoming crisis calls</h2>
          <Badge className="ml-auto bg-white/6 text-[8px] text-[#82918e]">
            {calls.length} CHANNELS
          </Badge>
        </div>
      </div>

      <div className="max-h-[255px] overflow-y-auto border-b border-white/8 p-2">
        <div className="space-y-1.5">
          {calls.map((call, callIndex) => {
            const session = sessions[call.id] ?? EMPTY_SESSION;
            const selected = selectedCall?.id === call.id;
            const isActive = activeCallId === call.id;
            const isPlaying = isActive && playbackState === 'playing';
            const callLabel = genericCallLabel(call, callIndex);
            return (
              <div
                key={call.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-2 transition-colors ${
                  selected
                    ? 'border-[#d79b39]/35 bg-[#d79b39]/7'
                    : 'border-white/7 bg-black/10 hover:bg-white/[0.025]'
                }`}
              >
                <button
                  type="button"
                  aria-label={`Open ${callLabel}`}
                  className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79b39]"
                  onClick={() => onSelect(call)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-1.5 rounded-full ${callSignalColor(session.status)}`}
                    />
                    <span className="truncate text-[10px] font-medium text-[#d5ddda]">
                      {callLabel}
                    </span>
                    <span className="ml-auto text-[8px] text-[#63736f]">
                      {formatTime(session.currentTime)}
                      {session.duration > 0
                        ? ` / ${formatTime(session.duration)}`
                        : ''}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 pl-3.5 text-[8px] uppercase tracking-[0.07em] text-[#667773]">
                    <span>{call.source}</span>
                    <span>·</span>
                    <span className={statusColor(session.status)}>
                      {session.status}
                    </span>
                  </div>
                </button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="border-white/10 bg-white/[0.025] text-[#b5c0bd]"
                  aria-label={`${isPlaying ? 'Pause' : 'Play'} ${callLabel}`}
                  disabled={
                    session.status === 'generating' ||
                    session.status === 'connecting'
                  }
                  onClick={() => onToggle(call)}
                >
                  {session.status === 'generating' ||
                  session.status === 'connecting' ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {selectedCall ? (
        <SelectedCallTranscript
          callLabel={genericCallLabel(
            selectedCall,
            Math.max(0, calls.indexOf(selectedCall)),
          )}
          session={selectedSession}
          active={activeCallId === selectedCall.id}
          analysisState={analysisState}
          onToggle={() => onToggle(selectedCall)}
        />
      ) : (
        <div className="grid flex-1 place-items-center text-[11px] text-[#667773]">
          Select an incoming call.
        </div>
      )}
    </section>
  );
}

function SelectedCallTranscript({
  callLabel,
  session,
  active,
  analysisState,
  onToggle,
}: {
  callLabel: string;
  session: CallSession;
  active: boolean;
  analysisState: AnalysisState;
  onToggle: () => void;
}) {
  const playing = session.status === 'playing';
  const progress = session.duration
    ? Math.min(100, (session.currentTime / session.duration) * 100)
    : 0;
  const waiting =
    session.transcriptTurns.length === 0 && !session.partialTranscript;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/8 bg-[#0f1719] p-3">
        <div className="flex items-center gap-2">
          <Button
            size="icon-sm"
            className="bg-[#d79b39] text-[#21180b] hover:bg-[#e3aa4c]"
            aria-label={`${playing ? 'Pause' : 'Play'} selected call`}
            onClick={onToggle}
          >
            {session.status === 'generating' ||
            session.status === 'connecting' ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : playing ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium">{callLabel}</p>
            <p className="mt-0.5 text-[8px] uppercase tracking-[0.08em] text-[#687975]">
              Gradium synthetic conversation · AssemblyAI Universal-3 Pro
            </p>
          </div>
          <span className="text-[9px] text-[#82918e]">
            {formatTime(session.currentTime)} / {formatTime(session.duration)}
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/7">
          <div
            className="h-full rounded-full bg-[#d79b39] transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-white/7 px-3 py-2 text-[8px] uppercase tracking-[0.1em] text-[#6f807c]">
        <span
          className={`size-1.5 rounded-full ${playing ? 'animate-pulse bg-[#65c9a3]' : 'bg-[#667773]'}`}
        />
        Live STT · {session.transcriptTurns.length} finalized turns
        {analysisState === 'analyzing' && (
          <span className="ml-auto flex items-center gap-1 text-[#d8a556]">
            <Sparkles className="size-3 animate-pulse" /> updating memory
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3">
        {waiting ? (
          <div className="grid h-full min-h-[180px] place-items-center rounded-md border border-dashed border-white/8 bg-black/10 p-6 text-center">
            <div>
              <AudioLines className="mx-auto size-5 text-[#596965]" />
              <p className="mt-2 text-[10px] text-[#788984]">
                {session.status === 'generating'
                  ? 'Gradium is generating the complete two-voice call…'
                  : session.status === 'connecting'
                    ? 'Connecting the audio stream to AssemblyAI…'
                    : 'Press play. Transcript text appears only after AssemblyAI hears the audio.'}
              </p>
            </div>
          </div>
        ) : (
          <LiveTranscriptText
            turns={session.transcriptTurns}
            partialTranscript={session.partialTranscript}
          />
        )}
        {session.error && (
          <p className="mt-3 flex items-start gap-2 rounded border border-[#d79b39]/20 bg-[#d79b39]/7 p-2 text-[9px] leading-relaxed text-[#d7ad69]">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            {session.error}
          </p>
        )}
        {!active && session.status === 'paused' && (
          <p className="mt-3 text-center text-[8px] uppercase tracking-[0.1em] text-[#71817d]">
            Paused at {formatTime(session.currentTime)} · press play to
            reconnect and resume
          </p>
        )}
      </div>
    </div>
  );
}

function LiveTranscriptText({
  turns,
  partialTranscript,
}: {
  turns: TranscriptTurn[];
  partialTranscript: string;
}) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const finalizedText = turns.map((turn) => turn.text).join(' ');

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [finalizedText, partialTranscript]);

  return (
    <div
      ref={transcriptRef}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md border border-white/8 bg-black/12 p-3"
      aria-live="polite"
      aria-label="Live AssemblyAI transcript"
    >
      <p className="whitespace-pre-wrap text-[11px] leading-6 text-[#d1d9d7]">
        {finalizedText}
        {finalizedText && partialTranscript ? ' ' : ''}
        {partialTranscript && (
          <span className="text-[#8ea09c] opacity-80">
            {partialTranscript}
            <span className="ml-1 inline-block size-1 animate-pulse rounded-full bg-[#65c9a3]" />
          </span>
        )}
      </p>
    </div>
  );
}

function ObservedLocations({
  memories,
  selectedCallId,
  onSelectCall,
}: {
  memories: IncidentMemory[];
  selectedCallId: string;
  onSelectCall: (callId: string) => void;
}) {
  const discovered = Array.from(
    memories.reduce((locations, memory) => {
      const locationName = memory.incident.locationName.trim();
      if (
        !locationName ||
        /^(unknown|location not established|not established)$/i.test(
          locationName,
        )
      ) {
        return locations;
      }
      const locationKey = locationName.toLocaleLowerCase('en-US');
      const current = locations.get(locationKey) ?? [];
      current.push(memory);
      locations.set(locationKey, current);
      return locations;
    }, new globalThis.Map<string, IncidentMemory[]>()),
  );

  return (
    <section className="mt-3 rounded-md border border-white/8 bg-[#11191b] p-3">
      <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.11em] text-[#70817d]">
        <MapPin className="size-3.5" aria-hidden="true" />
        Observed incident locations
      </div>
      {discovered.length === 0 ? (
        <div className="rounded-md border border-dashed border-white/8 bg-black/10 px-4 py-6 text-center text-[9px] text-[#687975]">
          Locations appear only after the LLM extracts a place from finalized
          live STT.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {discovered.map(([locationKey, locationMemories]) => {
            const latest = locationMemories[0];
            const active = locationMemories.some(
              (memory) => memory.callId === selectedCallId,
            );
            return (
              <button
                key={locationKey}
                type="button"
                onClick={() => onSelectCall(latest.callId)}
                aria-pressed={active}
                className={`min-w-0 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79b39] ${
                  active
                    ? 'border-[#d79b39]/35 bg-[#d79b39]/9'
                    : 'border-white/8 bg-[#0e1517] hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex items-center gap-2 truncate text-[10px] font-medium text-[#cbd5d2]">
                  <span
                    className={`size-1.5 rounded-full ${severityColor(latest.incident.severity)}`}
                  />
                  {latest.incident.locationName}
                </span>
                <span className="mt-1 block truncate pl-3.5 text-[8px] text-[#687975]">
                  {locationMemories.length} incident{' '}
                  {locationMemories.length === 1 ? 'object' : 'objects'} ·{' '}
                  {latest.incident.metricLabel}: {latest.incident.metricValue}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function IncidentMemoryGrid({
  memories,
  selectedCallId,
  onSelectCall,
}: {
  memories: IncidentMemory[];
  selectedCallId: string;
  onSelectCall: (callId: string) => void;
}) {
  return (
    <section className="mt-3 rounded-md border border-[#d79b39]/18 bg-[#11191b] p-3">
      <div className="flex items-center gap-2">
        <Layers3 className="size-4 text-[#d79b39]" aria-hidden="true" />
        <h2 className="text-xs font-semibold">AI live incident memory</h2>
        <Badge className="ml-auto border-[#d79b39]/18 bg-[#d79b39]/7 text-[8px] text-[#d6a253]">
          {memories.length} OBJECTS
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {memories.length === 0 ? (
          <div className="col-span-full rounded-md border border-dashed border-white/8 bg-black/10 px-4 py-8 text-center text-[9px] leading-relaxed text-[#687975]">
            No incident memory exists yet. A card appears only after finalized
            STT provides enough evidence for the LLM to create one.
          </div>
        ) : (
          memories.map((memory) => (
            <MemoryCard
              key={memory.callId}
              memory={memory}
              selected={memory.callId === selectedCallId}
              onSelect={() => onSelectCall(memory.callId)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function MemoryCard({
  memory,
  selected,
  onSelect,
}: {
  memory: IncidentMemory;
  selected: boolean;
  onSelect: () => void;
}) {
  const incident = memory.incident;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-[180px] rounded-md border p-3 text-left transition-colors ${
        selected
          ? 'border-[#d79b39]/38 bg-[#d79b39]/7'
          : 'border-white/8 bg-[#0d1416] hover:bg-white/[0.035]'
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 size-2 shrink-0 rounded-full ${severityColor(incident.severity)}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold text-[#d8e0de]">
            {incident.locationName}
          </p>
          <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-[#758580]">
            {hazardLabels[incident.hazardType]} · {incident.confidence}{' '}
            confidence
          </p>
        </div>
        <ChevronRight className="size-3.5 text-[#687975]" />
      </div>
      <ul className="mt-3 space-y-1.5 pl-4 text-[9px] leading-relaxed text-[#aebbb7]">
        <li className="list-disc">{incident.summary}</li>
        <li className="list-disc">
          {incident.metricLabel}: {incident.metricValue}
        </li>
        <li className="list-disc">
          Access: {titleCase(incident.access)} · trend: {incident.trend}
        </li>
        <li className="list-disc">
          People at risk: {incident.peopleAtRisk} · injuries:{' '}
          {incident.injuries}
        </li>
      </ul>
      <p className="mt-3 truncate border-t border-white/7 pt-2 text-[8px] text-[#61716d]">
        SOURCE · {memory.callLabel}
      </p>
    </button>
  );
}

function ReasoningTrail({
  callLabel,
  events,
  state,
  error,
}: {
  callLabel: string | undefined;
  events: ReasoningTrace[];
  state: AnalysisState;
  error: string;
}) {
  return (
    <section className="min-h-[330px] rounded-md border border-[#7766ba]/22 bg-[#12151c] p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[#a99ee0]" aria-hidden="true" />
        <h2 className="text-xs font-semibold">LLM operational analysis</h2>
        <Badge className="ml-auto border-[#7766ba]/20 bg-[#7766ba]/9 text-[8px] text-[#aaa0dd]">
          {state === 'analyzing' ? 'RUNNING' : `${events.length} EVENTS`}
        </Badge>
      </div>
      <div
        className="mt-3 max-h-[420px] space-y-2 overflow-y-auto overscroll-contain pr-1"
        data-analysis-scroll
      >
        {events.length === 0 ? (
          <div className="grid min-h-[210px] place-items-center rounded-md border border-dashed border-white/8 bg-black/10 p-6 text-center">
            <div>
              {state === 'analyzing' ? (
                <LoaderCircle className="mx-auto size-5 animate-spin text-[#a99ee0]" />
              ) : (
                <Sparkles className="mx-auto size-5 text-[#5f5a70]" />
              )}
              <p className="mt-2 text-[9px] leading-relaxed text-[#716c80]">
                {state === 'analyzing'
                  ? 'AssemblyAI LLM Gateway is evaluating the latest finalized turn.'
                  : `Analysis begins when ${callLabel ?? 'the selected call'} produces a finalized STT turn.`}
              </p>
            </div>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="rounded-md border border-white/7 bg-black/12 p-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${reasoningColor(event.kind)}`}
                />
                <span className="text-[8px] uppercase tracking-[0.1em] text-[#a99ee0]">
                  {event.kind.replaceAll('_', ' ')}
                </span>
                <span className="truncate text-[9px] font-medium text-[#c9c5d7]">
                  {event.title}
                </span>
                <span className="ml-auto shrink-0 text-[7px] text-[#666271]">
                  {formatTraceTime(event.createdAt)} · turn{' '}
                  {event.transcriptTurnCount}
                </span>
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-[#a9acb3]">
                {event.detail}
              </p>
              <p className="mt-2 border-l border-[#7766ba]/35 pl-2 text-[8px] italic leading-relaxed text-[#777481]">
                Evidence: “{event.evidence}”
              </p>
            </div>
          ))
        )}
        {state === 'analyzing' && events.length > 0 && (
          <p className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.1em] text-[#9a91ca]">
            <LoaderCircle className="size-3 animate-spin" /> latest turn in
            progress
          </p>
        )}
        {error && <p className="text-[9px] text-[#d5a35b]">{error}</p>}
      </div>
    </section>
  );
}

function BriefingPanel({
  memory,
  text,
  speaking,
  error,
  onSpeak,
}: {
  memory: IncidentMemory | undefined;
  text: string;
  speaking: boolean;
  error: string;
  onSpeak: () => void;
}) {
  return (
    <section className="min-h-[330px] rounded-md border border-[#4dbb91]/22 bg-[#101a19] p-3">
      <div className="flex items-center gap-2">
        <Volume2 className="size-4 text-[#65c9a3]" aria-hidden="true" />
        <h2 className="text-xs font-semibold">Live command briefing</h2>
      </div>
      {memory ? (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.1em] text-[#65c9a3]">
            <CheckCircle2 className="size-3" /> memory synchronized
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-[#c8d5d1]">
            {text}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded border border-white/7 bg-white/7">
            <SmallFact
              label="Severity"
              value={titleCase(memory.incident.severity)}
            />
            <SmallFact
              label="Confidence"
              value={titleCase(memory.incident.confidence)}
            />
            <SmallFact
              label="Access"
              value={titleCase(memory.incident.access)}
            />
            <SmallFact label="Trend" value={memory.incident.trend} />
          </div>
        </div>
      ) : (
        <div className="grid min-h-[220px] place-items-center text-center text-[9px] leading-relaxed text-[#657672]">
          The command briefing appears after the selected call creates an
          incident memory object.
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={!memory || speaking}
        className="mt-3 w-full border-[#4dbb91]/25 bg-[#4dbb91]/8 text-[#8dd7bb] hover:bg-[#4dbb91]/14"
        onClick={onSpeak}
      >
        {speaking ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Volume2 className="size-3.5" />
        )}
        {speaking ? 'Generating briefing' : 'Play spoken briefing'}
      </Button>
      {error && <p className="mt-2 text-[9px] text-[#d5a35b]">{error}</p>}
    </section>
  );
}

function AwaitingActions() {
  return (
    <section className="min-h-[330px] rounded-md border border-[#dd644c]/18 bg-[#151817] p-3">
      <div className="flex items-center gap-2">
        <Send className="size-4 text-[#e3836e]" />
        <h2 className="text-xs font-semibold">Recommended follow-up actions</h2>
      </div>
      <div className="grid min-h-[250px] place-items-center text-center text-[9px] leading-relaxed text-[#6e7774]">
        Proposals appear only after the LLM Gateway creates a source-linked
        incident record. Human authorization remains required.
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#101719] px-3 py-2.5">
      <p className="text-[8px] uppercase tracking-[0.1em] text-[#657672]">
        {label}
      </p>
      <p className="mt-1 truncate text-[10px] text-[#cbd6d3]">{value}</p>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0f1717] p-2">
      <p className="text-[8px] uppercase tracking-[0.08em] text-[#61736e]">
        {label}
      </p>
      <p className="mt-1 truncate text-[9px] text-[#aebdb8]">{value}</p>
    </div>
  );
}

function callSignalColor(status: CallStatus) {
  if (status === 'error') return 'bg-[#dd644c]';
  if (status === 'playing' || status === 'analyzing') return 'bg-[#d79b39]';
  if (status === 'processed') return 'bg-[#65c9a3]';
  return 'bg-[#607b78]';
}

function statusColor(status: CallStatus) {
  if (status === 'playing') return 'text-[#65c9a3]';
  if (status === 'error') return 'text-[#dd7c68]';
  if (
    status === 'generating' ||
    status === 'connecting' ||
    status === 'analyzing'
  )
    return 'text-[#d7a14d]';
  if (status === 'processed') return 'text-[#8f9d99]';
  return 'text-[#667773]';
}

function severityColor(severity: IncidentSnapshot['severity']) {
  if (severity === 'critical') return 'bg-[#ed5d4d]';
  if (severity === 'high') return 'bg-[#dd764f]';
  if (severity === 'moderate') return 'bg-[#d7a143]';
  return 'bg-[#67968b]';
}

function reasoningColor(kind: ReasoningEvent['kind']) {
  if (kind === 'action_proposal') return 'bg-[#dd8b55]';
  if (kind === 'uncertainty') return 'bg-[#d7b359]';
  if (kind === 'memory_create' || kind === 'memory_update')
    return 'bg-[#65c9a3]';
  if (kind === 'inference') return 'bg-[#9b8bd9]';
  return 'bg-[#75a8c4]';
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatTraceTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function titleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}
