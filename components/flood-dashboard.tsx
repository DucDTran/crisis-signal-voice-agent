'use client';

import {
  Activity,
  AlertTriangle,
  AudioLines,
  Bell,
  Check,
  Clock3,
  Database,
  Headphones,
  Layers3,
  LoaderCircle,
  Map,
  Mic,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { VinhMap } from '@/components/vinh-map';
import { useAssemblyAIStream } from '@/hooks/use-assemblyai-stream';
import {
  actionCatalog,
  hazardLabels,
  isIncidentSnapshot,
  scenarios,
  type ActionId,
  type IncidentSnapshot,
  type LocationId,
  type Scenario,
  type ScenarioCall,
  type ScenarioId,
  type ScenarioReport,
} from '@/lib/incidents';

type StreamStage = 'ready' | 'public' | 'field' | 'complete';
type ReportId = 'public' | 'field';
type KnownLocationId = Exclude<LocationId, 'unknown'>;
type AnalysisState = 'idle' | 'analyzing' | 'ready' | 'error';
type ActionStatuses = Partial<Record<ActionId, 'dispatched'>>;
type CallStatus = 'queued' | 'listening' | 'analyzing' | 'processed';

const landmarks: Record<KnownLocationId, { name: string; meta: string }> = {
  bridge: {
    name: 'Ben Thuy Bridge 1',
    meta: 'Northern approach, Vinh side',
  },
  station: {
    name: 'Vinh Railway Station',
    meta: 'Transport hub',
  },
  market: {
    name: 'Vinh Market',
    meta: 'Community and trading district',
  },
  university: {
    name: 'Vinh University',
    meta: 'Relief staging destination',
  },
  mountain: {
    name: 'Nui Quyet',
    meta: 'Mountain access road',
  },
};

const navItems = [
  { label: 'Operations', icon: Activity, active: true },
  { label: 'Incident map', icon: Map },
  { label: 'Voice streams', icon: AudioLines },
  { label: 'Response teams', icon: Users },
  { label: 'Data sources', icon: Database },
];

export function FloodDashboard() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('flood');
  const [stage, setStage] = useState<StreamStage>('ready');
  const [revealedWords, setRevealedWords] = useState(0);
  const [selectedLocation, setSelectedLocation] =
    useState<KnownLocationId>('bridge');
  const [briefingVisible, setBriefingVisible] = useState(false);
  const [liveIncident, setLiveIncident] = useState<IncidentSnapshot | null>(
    null,
  );
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [analysisError, setAnalysisError] = useState('');
  const [actionStatuses, setActionStatuses] = useState<ActionStatuses>({});
  const [selectedCallId, setSelectedCallId] = useState('flood-call-01');
  const [callStatuses, setCallStatuses] = useState<Record<string, CallStatus>>({});
  const [fixtureMode, setFixtureMode] = useState(false);
  const stageRef = useRef<StreamStage>('ready');
  const speechBoundarySeen = useRef<Record<ReportId, boolean>>({
    public: false,
    field: false,
  });
  const fallbackTimers = useRef<Partial<Record<ReportId, number>>>({});
  const stream = useAssemblyAIStream();
  const startFixture = stream.startFixture;

  const scenario = scenarios[scenarioId];
  const calls = scenario.calls;
  const selectedCall = calls.find((call) => call.id === selectedCallId) ?? calls[0];
  const publicReport = scenario.publicReport;
  const fieldReport = scenario.fieldReport;
  const activeReport =
    stage === 'public' ? publicReport : stage === 'field' ? fieldReport : null;
  const activeWords = useMemo(
    () => activeReport?.text.split(' ') ?? [],
    [activeReport],
  );
  const progress = activeWords.length
    ? Math.min(1, revealedWords / activeWords.length)
    : stage === 'complete'
      ? 1
      : 0;

  const publicComplete = stage === 'field' || stage === 'complete';
  const fieldSeen = stage === 'field' || stage === 'complete';
  const fieldComplete = stage === 'complete';
  const fieldProgress = stage === 'field' ? progress : fieldComplete ? 1 : 0;
  const publicProgress = stage === 'public' ? progress : publicComplete ? 1 : 0;

  const locationKnown = publicProgress >= 0.26 || fieldSeen;
  const hazardKnown = publicProgress >= 0.44 || fieldSeen;
  const trendKnown = publicProgress >= 0.74 || fieldSeen;
  const metricKnown = fieldProgress >= 0.48;
  const accessKnown = fieldProgress >= 0.68;
  const peopleKnown = fieldProgress >= 0.82;

  const liveMode =
    stream.state === 'connecting' ||
    stream.state === 'listening' ||
    stream.finalTurns.length > 0 ||
    Boolean(liveIncident);
  const displayedIncident = liveIncident ?? scenario.incident;
  const incidentLocation =
    liveIncident?.locationId ?? scenario.incident.locationId;
  const mapStatus = liveIncident
    ? liveIncident.confidence === 'high'
      ? 'verified'
      : 'reported'
    : metricKnown
      ? 'verified'
      : hazardKnown
        ? 'reported'
        : 'idle';
  const metricValue = liveIncident
    ? liveIncident.metricValue === 'Unknown'
      ? null
      : liveIncident.metricValue
    : metricKnown
      ? scenario.incident.metricValue
      : hazardKnown
        ? 'Awaiting field report'
        : null;
  const selected = landmarks[selectedLocation];
  const selectedIsIncident = selectedLocation === incidentLocation;
  const activeIncidentLocations = calls
    .filter((call) => callStatuses[call.id] && callStatuses[call.id] !== 'queued')
    .map((call) => call.locationId);
  const actionsIncident =
    liveIncident ?? (stage === 'complete' ? scenario.incident : null);
  const reasoningEntries = buildReasoningEntries({
    stage,
    liveIncident,
    analysisState,
    streamTurns: stream.finalTurns.length,
    summary: { locationKnown, hazardKnown, trendKnown, metricKnown, accessKnown, peopleKnown },
    callCount: calls.length,
    processedCallCount: Object.values(callStatuses).filter((status) => status === 'processed').length,
    activeCallTitle: selectedCall?.title ?? 'Incoming call',
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (stage === 'public' && calls[0]) {
        setSelectedCallId(calls[0].id);
        setCallStatuses((current) => ({ ...current, [calls[0].id]: 'listening' }));
      }
      if (stage === 'field' && calls[1]) {
        setSelectedCallId(calls[1].id);
        setCallStatuses((current) => ({
          ...current,
          [calls[0]?.id ?? '']: 'processed',
          [calls[1].id]: 'listening',
        }));
      }
      if (stage === 'complete') {
        setCallStatuses((current) => ({
          ...current,
          [calls[0]?.id ?? '']: 'processed',
          [calls[1]?.id ?? '']: 'processed',
        }));
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [calls, stage]);

  useEffect(() => {
    if (stage !== 'complete' || calls.length < 3) return;
    const timers: number[] = [];
    const extraCalls = calls.slice(2);
    extraCalls.forEach((call, index) => {
      const startDelay = index * 8500;
      const startTimer = window.setTimeout(() => {
        setSelectedCallId(call.id);
        setCallStatuses((current) => ({ ...current, [call.id]: 'listening' }));
        if (call.audioUrl) {
          void startFixture(call.audioUrl).catch(() => {
            setCallStatuses((current) => ({ ...current, [call.id]: 'processed' }));
          });
        } else if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(
            call.turns.map((turn) => `${turn.speaker}: ${turn.text}`).join(' '),
          );
          utterance.lang = 'en-US';
          utterance.rate = 0.96;
          utterance.onstart = () => {
            setCallStatuses((current) => ({ ...current, [call.id]: 'analyzing' }));
          };
          utterance.onend = () => {
            setCallStatuses((current) => ({ ...current, [call.id]: 'processed' }));
          };
          utterance.onerror = () => {
            setCallStatuses((current) => ({ ...current, [call.id]: 'processed' }));
          };
          window.speechSynthesis.speak(utterance);
        } else {
          setCallStatuses((current) => ({ ...current, [call.id]: 'processed' }));
        }
      }, startDelay);
      timers.push(startTimer);
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [calls, stage, startFixture]);

  const speakSimulationReport = useCallback((report: ScenarioReport) => {
    const totalWords = report.text.split(/\s+/).filter(Boolean).length;
    speechBoundarySeen.current[report.id] = false;
    if (!('speechSynthesis' in window)) {
      if (stageRef.current === report.id) setRevealedWords(totalWords);
      return;
    }

    const clearFallback = () => {
      const timer = fallbackTimers.current[report.id];
      if (timer) window.clearInterval(timer);
      delete fallbackTimers.current[report.id];
    };
    const utterance = new SpeechSynthesisUtterance(report.text);
    utterance.lang = 'en-US';
    utterance.rate = report.id === 'public' ? 0.96 : 0.98;
    utterance.onstart = () => {
      const startedAt = Date.now();
      clearFallback();
      fallbackTimers.current[report.id] = window.setInterval(() => {
        if (speechBoundarySeen.current[report.id]) return;
        if (stageRef.current !== report.id) return;
        const elapsedWords = Math.floor((Date.now() - startedAt) / 220);
        setRevealedWords((current) => Math.min(totalWords, Math.max(current, elapsedWords)));
      }, 100);
    };
    utterance.onboundary = (event) => {
      speechBoundarySeen.current[report.id] = true;
      if (stageRef.current !== report.id) return;
      const spoken = report.text.slice(0, event.charIndex).trim();
      const words = spoken ? spoken.split(/\s+/).length : 0;
      setRevealedWords((current) => Math.min(totalWords, Math.max(current, words)));
    };
    utterance.onend = () => {
      clearFallback();
      if (stageRef.current === report.id) setRevealedWords(totalWords);
    };
    utterance.onerror = () => {
      clearFallback();
      if (stageRef.current === report.id) setRevealedWords(totalWords);
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (!activeReport || revealedWords < activeWords.length) return;
    const delay = window.setTimeout(() => {
      if (stage === 'public') {
        stageRef.current = 'field';
        setStage('field');
        setRevealedWords(0);
        speakSimulationReport(fieldReport);
      } else if (stage === 'field') {
        stageRef.current = 'complete';
        setStage('complete');
        setBriefingVisible(true);
      }
    }, 700);
    return () => window.clearTimeout(delay);
  }, [activeReport, activeWords.length, fieldReport, revealedWords, speakSimulationReport, stage]);

  useEffect(() => {
    const transcript = stream.finalTurns.join(' ').trim();
    if (!transcript) return;

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setAnalysisState('analyzing');
        setAnalysisError('');
      }
    });

    void fetch('/api/analyze-incident', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          incident?: unknown;
          error?: string;
        };
        if (!response.ok || !isIncidentSnapshot(body.incident)) {
          throw new Error(body.error ?? 'Live incident analysis failed.');
        }
        setLiveIncident(body.incident);
        setAnalysisState('ready');
        setBriefingVisible(true);
        if (body.incident.locationId !== 'unknown') {
          setSelectedLocation(body.incident.locationId);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setAnalysisError(
          error instanceof Error ? error.message : 'Live analysis failed.',
        );
        setAnalysisState('error');
      });

    return () => controller.abort();
  }, [stream.finalTurns]);

  useEffect(() => {
    if (!fixtureMode || stream.finalTurns.length === 0) return;
    const nextAudioUrl = calls[1]?.audioUrl;
    if (stage === 'public' && nextAudioUrl) {
      const timer = window.setTimeout(() => {
        stageRef.current = 'field';
        setStage('field');
        setRevealedWords(0);
        setSelectedCallId(calls[1].id);
        void startFixture(nextAudioUrl);
      }, 0);
      return () => window.clearTimeout(timer);
    } else if (stage === 'field') {
      const timer = window.setTimeout(() => {
        stageRef.current = 'complete';
        setStage('complete');
        setBriefingVisible(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [calls, fixtureMode, stage, startFixture, stream.finalTurns]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  function startSimulation() {
    stream.reset();
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
    setCallStatuses(Object.fromEntries(calls.map((call) => [call.id, 'queued'])));
    setSelectedCallId(calls[0]?.id ?? '');
    setFixtureMode(true);
    stageRef.current = 'public';
    setStage('public');
    setRevealedWords(0);
    setSelectedLocation(scenario.incident.locationId as KnownLocationId);
    setBriefingVisible(false);
    if (calls[0]?.audioUrl) {
      void startFixture(calls[0].audioUrl);
    } else {
      speakSimulationReport(publicReport);
    }
  }

  function resetSimulation() {
    window.speechSynthesis?.cancel();
    stageRef.current = 'ready';
    stream.reset();
    setStage('ready');
    setRevealedWords(0);
    setSelectedLocation(scenario.incident.locationId as KnownLocationId);
    setBriefingVisible(false);
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
    setCallStatuses({});
    setSelectedCallId(calls[0]?.id ?? '');
    setFixtureMode(false);
  }

  function changeScenario(value: ScenarioId | null) {
    if (!value) return;
    window.speechSynthesis?.cancel();
    stageRef.current = 'ready';
    stream.reset();
    const nextScenario = scenarios[value];
    setScenarioId(value);
    setStage('ready');
    setRevealedWords(0);
    setSelectedLocation(nextScenario.incident.locationId as KnownLocationId);
    setBriefingVisible(false);
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
    setCallStatuses(Object.fromEntries(nextScenario.calls.map((call) => [call.id, 'queued'])));
    setSelectedCallId(nextScenario.calls[0]?.id ?? '');
    setFixtureMode(false);
  }

  async function startLiveIncident() {
    window.speechSynthesis?.cancel();
    stageRef.current = 'ready';
    setStage('ready');
    setRevealedWords(0);
    setBriefingVisible(false);
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
    setCallStatuses(Object.fromEntries(calls.map((call) => [call.id, 'queued'])));
    setSelectedCallId(calls[0]?.id ?? '');
    setFixtureMode(false);
    await stream.start();
  }

  function speakBriefing() {
    setBriefingVisible(true);
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const actionText = displayedIncident.recommendedActionIds
      .map((id) => actionCatalog[id].title)
      .join(', ');
    const text = liveIncident
      ? `${liveIncident.summary} Recommended actions for operator review: ${actionText}.`
      : scenario.briefing;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.94;
    window.speechSynthesis.speak(utterance);
  }

  function speakOperatorPrompt(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/^Operator:\s*/i, ''));
    utterance.lang = 'en-US';
    utterance.rate = 0.98;
    window.speechSynthesis.speak(utterance);
  }

  function dispatchAction(actionId: ActionId) {
    setActionStatuses((current) => ({
      ...current,
      [actionId]: 'dispatched',
    }));
  }

  const actionLabel =
    stage === 'ready'
      ? 'Run scenario'
      : stage === 'complete'
        ? 'Replay scenario'
        : 'Streaming scenario';

  return (
    <TooltipProvider>
      <main className="min-h-[100dvh] bg-[#0b1012] text-[#edf2f0]">
        <header className="flex min-h-16 flex-wrap items-center gap-3 border-b border-white/8 bg-[#0c1214] px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-md border border-[#d79b39]/35 bg-[#d79b39]/10 text-[#e3aa4c]">
              <Waves className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-tight">
                CrisisSignal
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#7f918d]">
                Multi-hazard crisis memory
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Badge className="hidden border-[#d79b39]/30 bg-[#d79b39]/10 font-mono text-[9px] uppercase tracking-[0.08em] text-[#e6b35f] xl:inline-flex">
              Demo · no external dispatch
            </Badge>
            <Select value={scenarioId} onValueChange={changeScenario}>
              <SelectTrigger
                size="sm"
                aria-label="Choose disaster scenario"
                className="w-[130px] border-white/10 bg-white/[0.025] text-xs text-[#c6d1ce]"
              >
                <SelectValue>{scenario.shortName}</SelectValue>
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#11191b] text-[#d7e0dd]">
                {(Object.keys(scenarios) as ScenarioId[]).map((id) => (
                  <SelectItem key={id} value={id}>
                    {scenarios[id].shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={startSimulation}
              disabled={
                stage === 'public' ||
                stage === 'field' ||
                stream.state === 'connecting' ||
                stream.state === 'listening'
              }
              className="min-w-[132px] bg-[#d79b39] text-[#1d160b] hover:bg-[#e9ae4c]"
            >
              {stage === 'public' || stage === 'field' ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Play className="size-3.5" aria-hidden="true" />
              )}
              {actionLabel}
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Reset incident"
                    onClick={resetSimulation}
                  />
                }
              >
                <RefreshCw className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Reset incident</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notifications"
                  />
                }
              >
                <Bell className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 lg:grid-cols-[208px_minmax(0,1fr)_410px]">
          <Sidebar liveMode={liveMode} />

          <section className="min-w-0 bg-[#0e1517]">
            <div className="flex min-h-[76px] flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3 lg:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      stage === 'public' ||
                      stage === 'field' ||
                      stream.state === 'listening'
                        ? 'animate-pulse bg-[#65c9a3] shadow-[0_0_0_4px_rgb(77_187_145/12%)]'
                        : liveIncident || stage === 'complete'
                          ? 'bg-[#dd644c] shadow-[0_0_0_4px_rgb(221_100_76/13%)]'
                          : 'bg-[#667773]'
                    }`}
                    aria-hidden="true"
                  />
                  <h1 className="truncate text-sm font-semibold">
                    {liveMode
                      ? 'Live multi-hazard incident intake'
                      : scenario.exerciseTitle}
                  </h1>
                </div>
                <p className="mt-1 pl-4 text-xs text-[#7f918d]">
                  {liveMode
                    ? 'Finalized speech turns become a structured, source-linked incident record.'
                    : 'Choose a hazard, stream the reports, then authorize simulated response actions.'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-[#7c8d89]">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {liveIncident || stage === 'complete'
                    ? '11:18'
                    : '11:06'} ICT
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  <ShieldCheck
                    className="size-3.5 text-[#4dbb91]"
                    aria-hidden="true"
                  />
                  Source-linked memory
                </span>
              </div>
            </div>

            <div className="grid grid-rows-[430px_auto]">
              <VinhMap
                status={mapStatus}
                hazardType={displayedIncident.hazardType}
                metricLabel={displayedIncident.metricLabel}
                metricValue={metricValue}
                selectedLocation={selectedLocation}
                incidentLocation={incidentLocation}
                activeIncidentLocations={activeIncidentLocations}
                evidenceMode={liveIncident ? 'live' : 'simulation'}
              />

              <div className="border-t border-white/8 bg-[#0c1214] p-4 lg:p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71827e]">
                      Selected map object
                    </p>
                    <h2 className="mt-1 text-base font-semibold">
                      {selected.name}
                    </h2>
                    <p className="text-xs text-[#899a96]">{selected.meta}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={mapStatus}
                      isIncident={selectedIsIncident}
                      incident={displayedIncident}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/10 bg-white/[0.03] text-[#c5d0cd]"
                    >
                      <Layers3 className="size-3.5" aria-hidden="true" />
                      Layers
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-px overflow-hidden rounded-md border border-white/8 bg-white/8 sm:grid-cols-3">
                  <Metric
                    label={displayedIncident.metricLabel}
                    value={metricValue ?? 'No confirmed value'}
                    live={
                      analysisState === 'analyzing' ||
                      (stage === 'field' && !metricKnown)
                    }
                  />
                  <Metric
                    label="Access"
                    value={
                      liveIncident
                        ? titleCase(liveIncident.access)
                        : accessKnown
                          ? titleCase(scenario.incident.access)
                          : 'Not established'
                    }
                    live={stage === 'field' && !accessKnown}
                  />
                  <Metric
                    label="People at risk"
                    value={
                      liveIncident
                        ? liveIncident.peopleAtRisk
                        : peopleKnown
                          ? scenario.incident.peopleAtRisk
                          : 'Not established'
                    }
                    live={stage === 'field' && !peopleKnown}
                  />
                </div>

                <TrackedPlaces
                  selectedLocation={selectedLocation}
                  onSelect={setSelectedLocation}
                />

                <div className="mt-5 space-y-3">
                  <LiveSummary
                    scenario={scenario}
                    summary={{
                      locationKnown,
                      hazardKnown,
                      trendKnown,
                      metricKnown,
                      accessKnown,
                      peopleKnown,
                    }}
                    stage={stage}
                    liveIncident={liveIncident}
                    analysisState={analysisState}
                  />

                  {(stage === 'complete' || liveIncident) && (
                    <BriefingPanel
                      text={liveIncident?.summary ?? scenario.briefing}
                      visible={briefingVisible}
                      onSpeak={speakBriefing}
                    />
                  )}

                  {actionsIncident && (
                    <ResponseActions
                      incident={actionsIncident}
                      statuses={actionStatuses}
                      onDispatch={dispatchAction}
                    />
                  )}

                </div>
              </div>
            </div>
          </section>

          <LiveOperationsPanel
            scenario={scenario}
            stage={stage}
            revealedWords={revealedWords}
            liveIncident={liveIncident}
            analysisState={analysisState}
            analysisError={analysisError}
            stream={stream}
            onStartLive={startLiveIncident}
            onStopLive={stream.stop}
            onSpeakOperator={speakOperatorPrompt}
            calls={calls}
            callStatuses={callStatuses}
            selectedCallId={selectedCallId}
            onSelectCall={setSelectedCallId}
            reasoningEntries={reasoningEntries}
            fixtureMode={fixtureMode}
          />
        </div>
      </main>
    </TooltipProvider>
  );
}

function Sidebar({ liveMode }: { liveMode: boolean }) {
  return (
    <aside className="hidden border-r border-white/8 bg-[#0c1214] lg:flex lg:flex-col">
      <nav className="space-y-1 p-3" aria-label="Primary navigation">
        <p className="px-2 pb-2 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#647470]">
          Command workspace
        </p>
        {navItems.map(({ label, icon: Icon, active }) => (
          <Button
            key={label}
            variant="ghost"
            className={`h-9 w-full justify-start gap-2.5 px-2.5 text-xs ${
              active
                ? 'bg-[#d79b39]/10 text-[#f0c477] hover:bg-[#d79b39]/15 hover:text-[#f0c477]'
                : 'text-[#91a29e] hover:bg-white/5 hover:text-[#e7eeec]'
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Button>
        ))}
      </nav>
      <div className="mt-auto border-t border-white/8 p-3">
        <div className="mb-3 rounded-md border border-white/8 bg-white/[0.025] p-3">
          <div className="flex items-center gap-2 text-xs text-[#aab8b5]">
            <Radio className="size-4 text-[#4dbb91]" aria-hidden="true" />
            {liveMode ? 'Live pipeline active' : 'Streaming pipeline ready'}
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#667773]">
            Live intake uses AssemblyAI Universal-3 Pro. Scenario replay uses
            local speech synthesis so the exercise works without a microphone.
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 text-xs text-[#82938f]"
        >
          <Settings className="size-4" aria-hidden="true" />
          Exercise settings
        </Button>
      </div>
    </aside>
  );
}

type SummaryState = {
  locationKnown: boolean;
  hazardKnown: boolean;
  trendKnown: boolean;
  metricKnown: boolean;
  accessKnown: boolean;
  peopleKnown: boolean;
};

type StreamController = ReturnType<typeof useAssemblyAIStream>;

function LiveOperationsPanel({
  scenario,
  stage,
  revealedWords,
  liveIncident,
  analysisState,
  analysisError,
  stream,
  onStartLive,
  onStopLive,
  onSpeakOperator,
  calls,
  callStatuses,
  selectedCallId,
  onSelectCall,
  reasoningEntries,
  fixtureMode,
}: {
  scenario: Scenario;
  stage: StreamStage;
  revealedWords: number;
  liveIncident: IncidentSnapshot | null;
  analysisState: AnalysisState;
  analysisError: string;
  stream: StreamController;
  onStartLive: () => Promise<void>;
  onStopLive: () => void;
  onSpeakOperator: (text: string) => void;
  calls: ScenarioCall[];
  callStatuses: Record<string, CallStatus>;
  selectedCallId: string;
  onSelectCall: (callId: string) => void;
  reasoningEntries: ReasoningEntry[];
  fixtureMode: boolean;
}) {
  const realStreamVisible =
    stream.state !== 'idle' || stream.finalTurns.length > 0 || liveIncident;

  return (
    <aside className="border-t border-white/8 bg-[#0b1113] lg:border-l lg:border-t-0">
      <div className="flex h-12 items-center border-b border-white/8 px-4">
        <Headphones className="mr-2 size-4 text-[#d79b39]" aria-hidden="true" />
        <h2 className="text-xs font-semibold">Live crisis stream</h2>
        <Badge
          className={`ml-auto font-mono text-[9px] ${
            stage === 'public' || stage === 'field' || stream.state === 'listening'
              ? 'bg-[#4dbb91]/12 text-[#78d0ae]'
              : analysisState === 'analyzing'
                ? 'bg-[#d79b39]/12 text-[#e6b35f]'
                : 'bg-white/7 text-[#9baba7]'
          }`}
        >
          {stream.state === 'listening' || stage === 'public' || stage === 'field'
            ? 'LIVE'
            : analysisState === 'analyzing'
              ? 'ANALYZING'
              : liveIncident || stage === 'complete'
                ? 'COMPLETE'
                : 'READY'}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        {(!realStreamVisible || fixtureMode) && (
          <>
            <CallQueue
              calls={calls}
              statuses={callStatuses}
              selectedCallId={selectedCallId}
              onSelect={onSelectCall}
            />
            <SelectedCallConversation
              call={calls.find((item) => item.id === selectedCallId) ?? calls[0]}
              status={callStatuses[selectedCallId] ?? 'queued'}
              stage={stage}
              revealedWords={revealedWords}
              onSpeakOperator={onSpeakOperator}
              scenario={scenario}
              liveTranscript={[stream.finalTranscript, stream.partialTranscript].filter(Boolean).join(' ')}
            />
          </>
        )}

        {realStreamVisible ? (
          <>
            <LiveMicrophone
              stream={stream}
              analysisState={analysisState}
              analysisError={analysisError}
              onStart={onStartLive}
              onStop={onStopLive}
            />
            {liveIncident && <LiveOperatorPrompt incident={liveIncident} />}
          </>
        ) : null}

        <ReasoningTrail entries={reasoningEntries} />

      </div>
    </aside>
  );
}

function CallQueue({
  calls,
  statuses,
  selectedCallId,
  onSelect,
}: {
  calls: ScenarioCall[];
  statuses: Record<string, CallStatus>;
  selectedCallId: string;
  onSelect: (callId: string) => void;
}) {
  return (
    <section className="rounded-md border border-white/9 bg-[#0f1719] p-3">
      <div className="flex items-center gap-2">
        <AudioLines className="size-4 text-[#d79b39]" aria-hidden="true" />
        <h3 className="text-xs font-semibold">Incoming crisis calls</h3>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.1em] text-[#71827e]">
          {calls.length} sources
        </span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-[#72827e]">
        Calls are correlated into one shared Vinh City incident record.
      </p>
      <Badge className="mt-2 bg-[#4dbb91]/10 font-mono text-[8px] text-[#78d0ae]">
        {calls.some((call) => call.audioUrl) ? 'ASSEMBLYAI FIXTURE PIPELINE' : 'OFFLINE SYNTHETIC REPLAY'}
      </Badge>
      <div className="mt-3 max-h-[350px] space-y-2 overflow-y-auto pr-1">
        {calls.map((call, index) => {
          const status = statuses[call.id] ?? 'queued';
          const active = call.id === selectedCallId;
          return (
            <button
              key={call.id}
              type="button"
              onClick={() => onSelect(call.id)}
              aria-pressed={active}
              className={`w-full rounded-md border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79b39] ${
                active
                  ? 'border-[#d79b39]/35 bg-[#d79b39]/8'
                  : 'border-white/8 bg-[#11191b] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] text-[#71827e]">CALL {String(index + 1).padStart(2, '0')}</span>
                <span className={`ml-auto font-mono text-[8px] uppercase tracking-[0.08em] ${
                  status === 'processed' ? 'text-[#65c9a3]' : status === 'queued' ? 'text-[#667773]' : 'text-[#e0ad59]'
                }`}>
                  {status}
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] font-medium text-[#cbd5d2]">{call.title}</p>
              <div className="mt-1 flex items-center gap-2 text-[9px] text-[#71827e]">
                <span>{call.source}</span>
                <span>·</span>
                <span className={call.priority === 'urgent' ? 'text-[#ef8f7c]' : 'text-[#8e9e9a]'}>{call.priority}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedCallConversation({
  call,
  status,
  stage,
  revealedWords,
  scenario,
  onSpeakOperator,
  liveTranscript,
}: {
  call: ScenarioCall | undefined;
  status: CallStatus;
  stage: StreamStage;
  revealedWords: number;
  scenario: Scenario;
  onSpeakOperator: (text: string) => void;
  liveTranscript: string;
}) {
  if (!call) return null;
  const primaryReport = call.id === scenario.calls[0]?.id ? scenario.publicReport : scenario.fieldReport;
  const livePrimary = call.id === scenario.calls[0]?.id && stage === 'public';
  const liveField = call.id === scenario.calls[1]?.id && stage === 'field';
  const live = livePrimary || liveField;
  const liveWords = primaryReport.text.split(/\s+/).filter(Boolean);
  const liveText = live
    ? liveTranscript || liveWords.slice(0, revealedWords).join(' ')
    : primaryReport.text;

  return (
    <section className="rounded-md border border-[#4dbb91]/22 bg-[#101a19] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Headphones className="size-3.5 text-[#65c9a3]" aria-hidden="true" />
            <h3 className="truncate text-xs font-semibold">{call.title}</h3>
          </div>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#71827e]">{call.source} · conversation turns</p>
        </div>
        <Badge className="bg-[#4dbb91]/12 font-mono text-[8px] text-[#78d0ae]">{status}</Badge>
      </div>
      {status === 'queued' ? (
        <p className="mt-3 text-[10px] leading-relaxed text-[#72827e]">Waiting for this source call to arrive in the simulation.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {call.turns.map((turn, index) => (
            <div key={`${call.id}-${index}`} className={`rounded-md border p-2.5 ${turn.speaker === 'operator' ? 'border-[#7184c5]/25 bg-[#111827]' : 'border-white/7 bg-black/10'}`}>
              <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.1em] text-[#778782]">
                <span className={turn.speaker === 'operator' ? 'text-[#9eafea]' : turn.speaker === 'field' ? 'text-[#e0ad59]' : 'text-[#65c9a3]'}>{turn.speaker}</span>
                {index === call.turns.length - 1 && live && <span className="text-[#65c9a3]">LIVE TRANSCRIPT</span>}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#cbd5d2]">{live && index === 0 ? liveText : turn.text}</p>
            </div>
          ))}
          {call.turns.some((turn) => turn.speaker === 'operator') && (
            <Button size="sm" variant="outline" className="border-[#7184c5]/25 bg-[#7184c5]/8 text-[#b8c4f1] hover:bg-[#7184c5]/14" onClick={() => onSpeakOperator(call.turns.find((turn) => turn.speaker === 'operator')?.text ?? '')}>
              <Volume2 className="size-3.5" aria-hidden="true" />
              Play operator turn
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function LiveOperatorPrompt({ incident }: { incident: IncidentSnapshot }) {
  const question = getOperatorQuestion(incident);

  return (
    <article className="rounded-md border border-[#7184c5]/25 bg-[#111827] p-3">
      <div className="flex items-center gap-2">
        <Users className="size-3.5 text-[#9eafea]" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b8c4f1]">
          Operator turn suggested
        </p>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#d4dcf6]">{question}</p>
      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-[#8390c3]">
        Generated from the latest finalized turn · ask before dispatch
      </p>
    </article>
  );
}

function getOperatorQuestion(incident: IncidentSnapshot) {
  return incident.hazardType === 'flood'
    ? 'Can you confirm the nearest landmark, whether anyone is trapped, and if the water is still rising?'
    : incident.hazardType === 'landslide'
      ? 'Can everyone stay clear of the slope, and is anyone isolated or injured right now?'
      : 'Can you confirm how many people are exposed and whether there is an immediate electrical or structural danger?';
}

type ReasoningEntry = {
  label: string;
  detail: string;
  state: 'done' | 'active' | 'waiting';
};

function buildReasoningEntries({
  stage,
  liveIncident,
  analysisState,
  streamTurns,
  summary,
  callCount,
  processedCallCount,
  activeCallTitle,
}: {
  stage: StreamStage;
  liveIncident: IncidentSnapshot | null;
  analysisState: AnalysisState;
  streamTurns: number;
  summary: SummaryState;
  callCount: number;
  processedCallCount: number;
  activeCallTitle: string;
}): ReasoningEntry[] {
  if (liveIncident || streamTurns > 0 || analysisState !== 'idle') {
    return [
      {
        label: 'Turn finalized',
        detail: streamTurns
          ? `AssemblyAI finalized ${streamTurns} ${streamTurns === 1 ? 'speech turn' : 'speech turns'}.`
          : 'Waiting for the first finalized AssemblyAI turn.',
        state: streamTurns ? 'done' : 'active',
      },
      {
        label: 'Extract incident facts',
        detail: liveIncident
          ? 'Hazard, place, measurement, access, and people-at-risk fields were extracted into the shared record.'
          : 'The LLM Gateway is separating stated facts from unknowns.',
        state: liveIncident ? 'done' : analysisState === 'analyzing' ? 'active' : 'waiting',
      },
      {
        label: 'Check map context',
        detail: liveIncident
          ? `Matched the report to ${liveIncident.locationName}.`
          : 'The map match will update when a location is identified.',
        state: liveIncident ? 'done' : 'waiting',
      },
      {
        label: 'Prepare response options',
        detail: 'Actions are proposals only; an operator must authorize every dispatch.',
        state: liveIncident ? 'done' : 'waiting',
      },
    ];
  }

  return [
    {
      label: 'Incoming calls',
      detail: `${processedCallCount} of ${callCount} source calls processed. ${activeCallTitle} is the current focus.`,
      state: stage === 'complete' ? 'done' : stage === 'public' || stage === 'field' ? 'active' : 'waiting',
    },
    {
      label: 'Extract incident facts',
      detail: summary.hazardKnown
        ? 'Hazard and location language are linked to the shared incident memory.'
        : 'Waiting for enough speech to identify the incident.',
      state: summary.hazardKnown ? 'done' : stage === 'public' ? 'active' : 'waiting',
    },
    {
      label: 'Reconcile sources',
      detail: summary.metricKnown
        ? 'Field measurement and access status are source-linked.'
        : 'Waiting for a confirming field or utility call.',
      state: summary.accessKnown ? 'done' : stage === 'field' ? 'active' : 'waiting',
    },
    {
      label: 'Prepare response options',
      detail: 'Recommendations remain proposals until the operator authorizes them.',
      state: stage === 'complete' ? 'done' : 'waiting',
    },
  ];
}

function ReasoningTrail({ entries }: { entries: ReasoningEntry[] }) {
  return (
    <section className="rounded-md border border-[#8c78bf]/25 bg-[#13121b] p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-[#b7a5e6]" aria-hidden="true" />
        <h3 className="text-xs font-semibold">LLM reasoning</h3>
        <Badge className="ml-auto bg-[#8c78bf]/15 font-mono text-[9px] text-[#c4b5ed]">
          OPERATIONAL TRACE
        </Badge>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-[#897e9f]">
        Concise, source-linked rationale for the command team — not hidden chain-of-thought.
      </p>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <div key={entry.label} className="flex gap-2.5 rounded border border-white/7 bg-black/10 p-2.5">
            <span
              className={`mt-0.5 size-2 shrink-0 rounded-full ${
                entry.state === 'done'
                  ? 'bg-[#65c9a3]'
                  : entry.state === 'active'
                    ? 'animate-pulse bg-[#e0ad59]'
                    : 'bg-[#667773]'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#a99cc5]">
                {entry.label}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-[#bdc4c1]">
                {entry.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveSummary({
  scenario,
  summary,
  stage,
  liveIncident,
  analysisState,
}: {
  scenario: Scenario;
  summary: SummaryState;
  stage: StreamStage;
  liveIncident: IncidentSnapshot | null;
  analysisState: AnalysisState;
}) {
  const incident = liveIncident ?? scenario.incident;
  const live =
    stage === 'public' || stage === 'field' || analysisState === 'analyzing';
  const listening =
    analysisState === 'analyzing' ? 'Analyzing latest turn' : 'Listening';
  const rows = liveIncident
    ? [
        ['Hazard', hazardLabels[incident.hazardType]],
        ['Location', incident.locationName],
        ['Trend', incident.trend],
        [incident.metricLabel, incident.metricValue],
        ['Access', titleCase(incident.access)],
        ['People', incident.peopleAtRisk],
      ]
    : [
        [
          'Hazard',
          summary.hazardKnown ? hazardLabels[incident.hazardType] : listening,
        ],
        ['Location', summary.locationKnown ? incident.locationName : listening],
        ['Trend', summary.trendKnown ? incident.trend : 'Not established'],
        [
          incident.metricLabel,
          summary.metricKnown ? incident.metricValue : 'Not established',
        ],
        [
          'Access',
          summary.accessKnown ? titleCase(incident.access) : 'Not established',
        ],
        [
          'People',
          summary.peopleKnown ? incident.peopleAtRisk : 'Not established',
        ],
      ];

  return (
    <section className="rounded-md border border-[#d79b39]/20 bg-[#11191b] p-3">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-[#d79b39]" aria-hidden="true" />
        <h3 className="text-xs font-semibold">AI live incident memory</h3>
        {live && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-[#65c9a3]">
            <span className="size-1.5 animate-pulse rounded-full bg-[#65c9a3]" />
            UPDATING
          </span>
        )}
      </div>
      <div className="mt-3 divide-y divide-white/7 border-y border-white/7">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[82px_1fr] gap-2 py-2 text-[11px]"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#697a76]">
              {label}
            </span>
            <span
              className={`transition-colors ${
                value === listening
                  ? 'animate-pulse text-[#71827e]'
                  : value === 'Not established'
                    ? 'text-[#687975]'
                    : 'text-[#c8d4d1]'
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
      {(liveIncident || stage === 'complete') && (
        <p className="mt-3 text-[10px] leading-relaxed text-[#9caeaa]">
          {incident.summary}
        </p>
      )}
      <p className="mt-3 font-mono text-[9px] leading-relaxed text-[#70817d]">
        Missing facts remain unknown. Recommendations never execute without
        operator authorization.
      </p>
    </section>
  );
}

function BriefingPanel({
  text,
  visible,
  onSpeak,
}: {
  text: string;
  visible: boolean;
  onSpeak: () => void;
}) {
  return (
    <section className="animate-in rounded-md border border-[#4dbb91]/24 bg-[#101a19] p-3 fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2">
        <Volume2 className="size-4 text-[#65c9a3]" aria-hidden="true" />
        <h3 className="text-xs font-semibold">Live command briefing</h3>
      </div>
      {visible && (
        <div className="mt-3" aria-live="polite">
          <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#65c9a3]">
            <Check className="size-3" aria-hidden="true" />
            Incident memory synchronized
          </div>
          <p className="text-[11px] leading-relaxed text-[#c8d5d1]">{text}</p>
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full border-[#4dbb91]/25 bg-[#4dbb91]/8 text-[#8dd7bb] hover:bg-[#4dbb91]/14 hover:text-[#a7e2cc]"
        onClick={onSpeak}
      >
        <Volume2 className="size-3.5" aria-hidden="true" />
        Play spoken briefing
      </Button>
    </section>
  );
}

function LiveMicrophone({
  stream,
  analysisState,
  analysisError,
  onStart,
  onStop,
}: {
  stream: StreamController;
  analysisState: AnalysisState;
  analysisError: string;
  onStart: () => Promise<void>;
  onStop: () => void;
}) {
  const listening = stream.state === 'listening';
  const transcript = [stream.finalTranscript, stream.partialTranscript]
    .filter(Boolean)
    .join(' ');

  return (
    <section className="rounded-md border border-[#4dbb91]/18 bg-[#0f1719] p-3">
      <div className="flex items-center gap-2">
        <Mic
          className={`size-3.5 ${listening ? 'text-[#65c9a3]' : 'text-[#71827e]'}`}
          aria-hidden="true"
        />
        <h3 className="text-[11px] font-medium">AssemblyAI live line</h3>
        <Badge className="ml-auto bg-white/6 font-mono text-[8px] text-[#788985]">
          ASSEMBLYAI LIVE · U3 PRO
        </Badge>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#687975]">
        Speak naturally into the incident line. AssemblyAI transcribes finalized
        turns and the LLM Gateway updates shared incident memory.
      </p>

      {(listening || transcript) && (
        <div className="mt-3 overflow-hidden rounded-md border border-white/8 bg-black/15">
          <Waveform active={listening} />
          <div className="border-t border-white/8 p-2.5">
            <TranscriptLabel active={listening} />
            <p
              className="mt-2 text-[11px] leading-relaxed text-[#bdcac6]"
              aria-live="polite"
            >
              {transcript || 'Listening for the first report…'}
            </p>
          </div>
        </div>
      )}

      {analysisState === 'analyzing' && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#e0ad59]">
          <Sparkles className="size-3 animate-pulse" aria-hidden="true" />
          Updating incident memory from the latest finalized turn…
        </p>
      )}
      {(stream.error || analysisError) && (
        <p
          className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-[#d7a95f]"
          role="alert"
        >
          <AlertTriangle
            className="mt-0.5 size-3 shrink-0"
            aria-hidden="true"
          />
          {stream.error || analysisError}
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="mt-3 w-full border-white/10 bg-white/[0.025] text-[#aebdb9]"
        disabled={stream.state === 'connecting'}
        onClick={() => {
          if (listening) onStop();
          else void onStart();
        }}
      >
        {stream.state === 'connecting' ? (
          <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
        ) : listening ? (
          <Pause className="size-3.5" aria-hidden="true" />
        ) : (
          <Mic className="size-3.5" aria-hidden="true" />
        )}
        {listening
          ? 'Stop live intake'
          : stream.state === 'connecting'
            ? 'Connecting securely'
            : transcript
              ? 'Start a new live intake'
              : 'Start live incident'}
      </Button>
    </section>
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: 42 }, (_, index) => (
        <span
          key={index}
          className={active ? 'animate-pulse' : ''}
          style={{
            height: `${8 + ((index * 17) % 27)}px`,
            animationDelay: `${index * 22}ms`,
          }}
        />
      ))}
    </div>
  );
}

function TranscriptLabel({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.11em] text-[#6f807c]">
      <span
        className={`size-1.5 rounded-full ${
          active ? 'animate-pulse bg-[#65c9a3]' : 'bg-[#667773]'
        }`}
        aria-hidden="true"
      />
      Live transcript
    </div>
  );
}

function TrackedPlaces({
  selectedLocation,
  onSelect,
}: {
  selectedLocation: KnownLocationId;
  onSelect: (location: KnownLocationId) => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.11em] text-[#70817d]">
        <Route className="size-3.5" aria-hidden="true" />
        Tracked places
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {(Object.keys(landmarks) as KnownLocationId[]).map((id) => {
          const place = landmarks[id];
          const active = id === selectedLocation;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-pressed={active}
              className={`min-w-0 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79b39] ${
                active
                  ? 'border-[#d79b39]/35 bg-[#d79b39]/9'
                  : 'border-white/8 bg-[#101719] hover:bg-white/[0.05]'
              }`}
            >
              <span className="block truncate text-[11px] font-medium text-[#cbd5d2]">
                {place.name}
              </span>
              <span className="mt-0.5 block truncate text-[9px] text-[#687975]">
                {place.meta}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  isIncident,
  incident,
}: {
  status: 'idle' | 'reported' | 'verified';
  isIncident: boolean;
  incident: IncidentSnapshot;
}) {
  if (!isIncident) {
    return <Badge className="bg-white/7 text-[#9baba7]">Reference place</Badge>;
  }
  if (status === 'verified') {
    return (
      <Badge className="border-[#dd644c]/35 bg-[#dd644c]/12 text-[#ef8f7c]">
        {hazardLabels[incident.hazardType]} · {incident.metricValue}
      </Badge>
    );
  }
  if (status === 'reported') {
    return (
      <Badge className="border-[#3b91aa]/35 bg-[#3b91aa]/12 text-[#9ed5e2]">
        {hazardLabels[incident.hazardType]} detected
      </Badge>
    );
  }
  return <Badge className="bg-white/7 text-[#9baba7]">Monitoring</Badge>;
}

function Metric({
  label,
  value,
  live = false,
}: {
  label: string;
  value: string;
  live?: boolean;
}) {
  return (
    <div className="bg-[#101719] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#657672]">
          {label}
        </p>
        {live && (
          <span
            className="size-1.5 animate-pulse rounded-full bg-[#65c9a3]"
            aria-hidden="true"
          />
        )}
      </div>
      <p className="mt-1 text-xs text-[#cbd6d3]">{value}</p>
    </div>
  );
}

function titleCase(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}
