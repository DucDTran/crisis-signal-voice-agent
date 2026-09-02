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
import { useEffect, useMemo, useState } from 'react';

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
  type ScenarioId,
  type ScenarioReport,
} from '@/lib/incidents';

type StreamStage = 'ready' | 'public' | 'field' | 'complete';
type ReportId = 'public' | 'field';
type KnownLocationId = Exclude<LocationId, 'unknown'>;
type AnalysisState = 'idle' | 'analyzing' | 'ready' | 'error';
type ActionStatuses = Partial<Record<ActionId, 'dispatched'>>;

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
  const [playingReport, setPlayingReport] = useState<ReportId | null>(null);
  const [briefingVisible, setBriefingVisible] = useState(false);
  const [liveIncident, setLiveIncident] = useState<IncidentSnapshot | null>(
    null,
  );
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle');
  const [analysisError, setAnalysisError] = useState('');
  const [actionStatuses, setActionStatuses] = useState<ActionStatuses>({});
  const stream = useAssemblyAIStream();

  const scenario = scenarios[scenarioId];
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
  const actionsIncident =
    liveIncident ?? (stage === 'complete' ? scenario.incident : null);

  useEffect(() => {
    if (!activeReport) return;
    const totalWords = activeReport.text.split(' ').length;
    const interval = window.setInterval(() => {
      setRevealedWords((current) => Math.min(totalWords, current + 1));
    }, 145);
    return () => window.clearInterval(interval);
  }, [activeReport]);

  useEffect(() => {
    if (!activeReport || revealedWords < activeWords.length) return;
    const delay = window.setTimeout(() => {
      if (stage === 'public') {
        setStage('field');
        setRevealedWords(0);
      } else if (stage === 'field') {
        setStage('complete');
        setBriefingVisible(true);
      }
    }, 700);
    return () => window.clearTimeout(delay);
  }, [activeReport, activeWords.length, revealedWords, stage]);

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
    return () => window.speechSynthesis?.cancel();
  }, []);

  function queueExerciseAudio() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    for (const report of [publicReport, fieldReport]) {
      const utterance = new SpeechSynthesisUtterance(report.text);
      utterance.lang = 'en-US';
      utterance.rate = report.id === 'public' ? 0.96 : 0.98;
      window.speechSynthesis.speak(utterance);
    }
  }

  function startSimulation() {
    stream.reset();
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
    setStage('public');
    setRevealedWords(0);
    setSelectedLocation(scenario.incident.locationId as KnownLocationId);
    setBriefingVisible(false);
    queueExerciseAudio();
  }

  function resetSimulation() {
    window.speechSynthesis?.cancel();
    stream.reset();
    setStage('ready');
    setRevealedWords(0);
    setSelectedLocation(scenario.incident.locationId as KnownLocationId);
    setPlayingReport(null);
    setBriefingVisible(false);
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
  }

  function changeScenario(value: ScenarioId | null) {
    if (!value) return;
    window.speechSynthesis?.cancel();
    stream.reset();
    const nextScenario = scenarios[value];
    setScenarioId(value);
    setStage('ready');
    setRevealedWords(0);
    setSelectedLocation(nextScenario.incident.locationId as KnownLocationId);
    setPlayingReport(null);
    setBriefingVisible(false);
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
  }

  async function startLiveIncident() {
    window.speechSynthesis?.cancel();
    setStage('ready');
    setRevealedWords(0);
    setPlayingReport(null);
    setBriefingVisible(false);
    setLiveIncident(null);
    setAnalysisState('idle');
    setAnalysisError('');
    setActionStatuses({});
    await stream.start();
  }

  function playReport(report: ScenarioReport) {
    if (!('speechSynthesis' in window)) return;
    if (playingReport === report.id) {
      window.speechSynthesis.cancel();
      setPlayingReport(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(report.text);
    utterance.lang = 'en-US';
    utterance.rate = 0.96;
    utterance.onend = () => setPlayingReport(null);
    utterance.onerror = () => setPlayingReport(null);
    setPlayingReport(report.id);
    window.speechSynthesis.speak(utterance);
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
              </div>
            </div>
          </section>

          <LiveOperationsPanel
            scenario={scenario}
            stage={stage}
            revealedWords={revealedWords}
            playingReport={playingReport}
            onPlayReport={playReport}
            summary={{
              locationKnown,
              hazardKnown,
              trendKnown,
              metricKnown,
              accessKnown,
              peopleKnown,
            }}
            liveIncident={liveIncident}
            analysisState={analysisState}
            analysisError={analysisError}
            briefingVisible={briefingVisible}
            onSpeakBriefing={speakBriefing}
            stream={stream}
            onStartLive={startLiveIncident}
            onStopLive={stream.stop}
            actionsIncident={actionsIncident}
            actionStatuses={actionStatuses}
            onDispatchAction={dispatchAction}
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
            AI recommendations require operator authorization. No external calls
            are made by this demo.
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
  playingReport,
  onPlayReport,
  summary,
  liveIncident,
  analysisState,
  analysisError,
  briefingVisible,
  onSpeakBriefing,
  stream,
  onStartLive,
  onStopLive,
  actionsIncident,
  actionStatuses,
  onDispatchAction,
}: {
  scenario: Scenario;
  stage: StreamStage;
  revealedWords: number;
  playingReport: ReportId | null;
  onPlayReport: (report: ScenarioReport) => void;
  summary: SummaryState;
  liveIncident: IncidentSnapshot | null;
  analysisState: AnalysisState;
  analysisError: string;
  briefingVisible: boolean;
  onSpeakBriefing: () => void;
  stream: StreamController;
  onStartLive: () => Promise<void>;
  onStopLive: () => void;
  actionsIncident: IncidentSnapshot | null;
  actionStatuses: ActionStatuses;
  onDispatchAction: (actionId: ActionId) => void;
}) {
  const activeReport =
    stage === 'public'
      ? scenario.publicReport
      : stage === 'field'
        ? scenario.fieldReport
        : null;
  const realStreamVisible =
    stream.state !== 'idle' || stream.finalTurns.length > 0 || liveIncident;

  return (
    <aside className="border-t border-white/8 bg-[#0b1113] lg:border-l lg:border-t-0">
      <div className="flex h-12 items-center border-b border-white/8 px-4">
        <Headphones className="mr-2 size-4 text-[#d79b39]" aria-hidden="true" />
        <h2 className="text-xs font-semibold">Live crisis stream</h2>
        <Badge
          className={`ml-auto font-mono text-[9px] ${
            activeReport || stream.state === 'listening'
              ? 'bg-[#4dbb91]/12 text-[#78d0ae]'
              : analysisState === 'analyzing'
                ? 'bg-[#d79b39]/12 text-[#e6b35f]'
                : 'bg-white/7 text-[#9baba7]'
          }`}
        >
          {stream.state === 'listening' || activeReport
            ? 'LIVE'
            : analysisState === 'analyzing'
              ? 'ANALYZING'
              : liveIncident || stage === 'complete'
                ? 'COMPLETE'
                : 'READY'}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        {realStreamVisible ? (
          <LiveMicrophone
            stream={stream}
            analysisState={analysisState}
            analysisError={analysisError}
            onStart={onStartLive}
            onStop={onStopLive}
          />
        ) : (
          <>
            <LiveTranscriptCard
              report={scenario.publicReport}
              active={stage === 'public'}
              complete={stage === 'field' || stage === 'complete'}
              revealedWords={stage === 'public' ? revealedWords : 0}
              playing={playingReport === 'public'}
              onPlay={onPlayReport}
            />

            {(stage === 'field' || stage === 'complete') && (
              <LiveTranscriptCard
                report={scenario.fieldReport}
                active={stage === 'field'}
                complete={stage === 'complete'}
                revealedWords={stage === 'field' ? revealedWords : 0}
                playing={playingReport === 'field'}
                onPlay={onPlayReport}
              />
            )}
          </>
        )}

        <LiveSummary
          scenario={scenario}
          summary={summary}
          stage={stage}
          liveIncident={liveIncident}
          analysisState={analysisState}
        />

        {(stage === 'complete' || liveIncident) && (
          <BriefingPanel
            text={liveIncident?.summary ?? scenario.briefing}
            visible={briefingVisible}
            onSpeak={onSpeakBriefing}
          />
        )}

        {actionsIncident && (
          <ResponseActions
            incident={actionsIncident}
            statuses={actionStatuses}
            onDispatch={onDispatchAction}
          />
        )}

        {!realStreamVisible && (
          <LiveMicrophone
            stream={stream}
            analysisState={analysisState}
            analysisError={analysisError}
            onStart={onStartLive}
            onStop={onStopLive}
          />
        )}
      </div>
    </aside>
  );
}

function LiveTranscriptCard({
  report,
  active,
  complete,
  revealedWords,
  playing,
  onPlay,
}: {
  report: ScenarioReport;
  active: boolean;
  complete: boolean;
  revealedWords: number;
  playing: boolean;
  onPlay: (report: ScenarioReport) => void;
}) {
  const words = report.text.split(' ');
  const transcript = complete
    ? report.text
    : active
      ? words.slice(0, revealedWords).join(' ')
      : '';

  return (
    <article
      className={`overflow-hidden rounded-md border bg-[#11191b] transition-colors ${
        active ? 'border-[#4dbb91]/35' : 'border-white/9'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-white/8 px-3 py-3">
        <button
          type="button"
          onClick={() => onPlay(report)}
          className="grid size-8 shrink-0 place-items-center rounded-md bg-[#d79b39] text-[#191309] transition-colors hover:bg-[#ebb760] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79b39] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11191b]"
          aria-label={`${playing ? 'Pause' : 'Play'} ${report.title}`}
        >
          {playing ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{report.title}</p>
          <p className="font-mono text-[10px] text-[#71827e]">
            {report.source}
          </p>
        </div>
        <span
          className={`font-mono text-[9px] ${
            active
              ? 'text-[#65c9a3]'
              : complete
                ? 'text-[#8fa09c]'
                : 'text-[#647470]'
          }`}
        >
          {active ? 'TRANSCRIBING' : complete ? 'CAPTURED' : 'QUEUED'}
        </span>
      </div>

      {(active || complete) && (
        <>
          <Waveform active={active} />
          <div className="min-h-[88px] border-t border-white/8 p-3">
            <TranscriptLabel active={active} />
            <p
              className="mt-2 text-xs leading-relaxed text-[#cad5d2]"
              aria-live="polite"
            >
              {transcript}
              {active && (
                <span className="ml-1 inline-block h-3 w-px animate-pulse bg-[#65c9a3]" />
              )}
            </p>
          </div>
        </>
      )}
    </article>
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
        <h3 className="text-[11px] font-medium">Live multi-hazard intake</h3>
        <Badge className="ml-auto bg-white/6 font-mono text-[8px] text-[#788985]">
          U3 PRO + LLM
        </Badge>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#687975]">
        Speak naturally. Finalized turns are transcribed by AssemblyAI and
        converted into a structured incident record.
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
