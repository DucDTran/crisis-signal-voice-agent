'use client';

import {
  Activity,
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
  Users,
  Volume2,
  Waves,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { type LocationId, VinhMap } from '@/components/vinh-map';
import { useAssemblyAIStream } from '@/hooks/use-assemblyai-stream';

type StreamStage = 'ready' | 'public' | 'field' | 'complete';
type ReportId = 'public' | 'field';

type Report = {
  id: ReportId;
  title: string;
  source: string;
  text: string;
};

const publicReport: Report = {
  id: 'public',
  title: 'Public call 01',
  source: 'MOBILE · 00:18',
  text: 'I am near Ben Thuy Bridge 1 on the Vinh side. Water is crossing the northern approach. I passed about five minutes ago. It still appears to be rising, but I cannot estimate the depth.',
};

const fieldReport: Report = {
  id: 'field',
  title: 'Road Team 3 radio',
  source: 'FIELD RADIO · 00:21',
  text: 'Road Team 3 reporting to coordination. At 11:18, moving water on the northern approach to Ben Thuy Bridge 1 is approximately 35 centimetres deep. The route is impassable. Barriers are in place. No road surface damage is visible.',
};

const landmarks: Record<LocationId, { name: string; meta: string }> = {
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
    meta: 'Community landmark',
  },
  university: {
    name: 'Vinh University',
    meta: 'Relief staging destination',
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
  const [stage, setStage] = useState<StreamStage>('ready');
  const [revealedWords, setRevealedWords] = useState(0);
  const [selectedLocation, setSelectedLocation] =
    useState<LocationId>('bridge');
  const [playingReport, setPlayingReport] = useState<ReportId | null>(null);
  const [briefingVisible, setBriefingVisible] = useState(false);
  const stream = useAssemblyAIStream();

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

  const publicSeen = stage !== 'ready';
  const publicComplete = stage === 'field' || stage === 'complete';
  const fieldSeen = stage === 'field' || stage === 'complete';
  const fieldComplete = stage === 'complete';
  const fieldProgress = stage === 'field' ? progress : fieldComplete ? 1 : 0;
  const publicProgress = stage === 'public' ? progress : publicComplete ? 1 : 0;

  const locationKnown = publicProgress >= 0.28 || fieldSeen;
  const floodObserved = publicProgress >= 0.48 || fieldSeen;
  const trendKnown = publicProgress >= 0.75 || fieldSeen;
  const depthKnown = fieldProgress >= 0.48;
  const closureKnown = fieldProgress >= 0.68;
  const barriersKnown = fieldProgress >= 0.82;

  const mapStatus = depthKnown
    ? 'verified'
    : floodObserved
      ? 'reported'
      : 'idle';
  const waterLevelLabel = depthKnown
    ? '35 cm'
    : floodObserved
      ? 'Depth unknown'
      : null;

  const selected = landmarks[selectedLocation];
  const selectedIsBridge = selectedLocation === 'bridge';

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
    return () => window.speechSynthesis?.cancel();
  }, []);

  function queueExerciseAudio() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const call = new SpeechSynthesisUtterance(publicReport.text);
    call.lang = 'en-US';
    call.rate = 0.96;
    const radio = new SpeechSynthesisUtterance(fieldReport.text);
    radio.lang = 'en-US';
    radio.rate = 0.98;
    window.speechSynthesis.speak(call);
    window.speechSynthesis.speak(radio);
  }

  function startSimulation() {
    stream.reset();
    setStage('public');
    setRevealedWords(0);
    setSelectedLocation('bridge');
    setBriefingVisible(false);
    queueExerciseAudio();
  }

  function resetSimulation() {
    window.speechSynthesis?.cancel();
    stream.reset();
    setStage('ready');
    setRevealedWords(0);
    setSelectedLocation('bridge');
    setPlayingReport(null);
    setBriefingVisible(false);
  }

  function playReport(report: Report) {
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
    const utterance = new SpeechSynthesisUtterance(
      'Ben Thuy Bridge 1 is currently impassable on the northern approach. Road Team 3 reported approximately 35 centimetres of moving water with barriers in place. Use Vinh University as the staging destination and confirm an alternate route with coordination.',
    );
    utterance.lang = 'en-US';
    utterance.rate = 0.94;
    window.speechSynthesis.speak(utterance);
  }

  const actionLabel =
    stage === 'ready'
      ? 'Run live simulation'
      : stage === 'complete'
        ? 'Replay simulation'
        : 'Streaming live';

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
                FloodSignal
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#7f918d]">
                Live crisis memory
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge className="hidden border-[#d79b39]/30 bg-[#d79b39]/10 font-mono text-[10px] uppercase tracking-[0.08em] text-[#e6b35f] sm:inline-flex">
              Fictional exercise
            </Badge>
            <Button
              size="sm"
              onClick={startSimulation}
              disabled={stage === 'public' || stage === 'field'}
              className="min-w-[148px] bg-[#d79b39] text-[#1d160b] hover:bg-[#e9ae4c]"
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
                    aria-label="Reset simulation"
                    onClick={resetSimulation}
                  />
                }
              >
                <RefreshCw className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Reset simulation</TooltipContent>
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

        <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 lg:grid-cols-[208px_minmax(0,1fr)_390px]">
          <Sidebar />

          <section className="min-w-0 bg-[#0e1517]">
            <div className="flex min-h-[76px] flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3 lg:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      stage === 'public' || stage === 'field'
                        ? 'animate-pulse bg-[#65c9a3] shadow-[0_0_0_4px_rgb(77_187_145/12%)]'
                        : stage === 'complete'
                          ? 'bg-[#dd644c] shadow-[0_0_0_4px_rgb(221_100_76/13%)]'
                          : 'bg-[#667773]'
                    }`}
                    aria-hidden="true"
                  />
                  <h1 className="truncate text-sm font-semibold">
                    Vinh flood response exercise
                  </h1>
                </div>
                <p className="mt-1 pl-4 text-xs text-[#7f918d]">
                  Audio becomes shared incident memory while responders speak.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-[#7c8d89]">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {stage === 'complete' ? '11:18' : '11:06'} ICT
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
                waterLevelLabel={waterLevelLabel}
                selectedLocation={selectedLocation}
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
                      isBridge={selectedIsBridge}
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
                    label="Water level"
                    value={
                      depthKnown
                        ? '35 cm'
                        : floodObserved
                          ? 'Unknown'
                          : 'No report'
                    }
                    live={stage === 'field' && !depthKnown}
                  />
                  <Metric
                    label="Access"
                    value={closureKnown ? 'Impassable' : 'Not established'}
                    live={stage === 'field' && !closureKnown}
                  />
                  <Metric
                    label="Source"
                    value={
                      depthKnown
                        ? 'Road Team 3'
                        : publicSeen
                          ? 'Public caller'
                          : 'Waiting'
                    }
                    live={stage === 'public' || stage === 'field'}
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
            stage={stage}
            revealedWords={revealedWords}
            playingReport={playingReport}
            onPlayReport={playReport}
            summary={{
              locationKnown,
              floodObserved,
              trendKnown,
              depthKnown,
              closureKnown,
              barriersKnown,
            }}
            briefingVisible={briefingVisible}
            onSpeakBriefing={speakBriefing}
            stream={stream}
          />
        </div>
      </main>
    </TooltipProvider>
  );
}

function Sidebar() {
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
            Streaming pipeline ready
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#667773]">
            Synthetic English audio. No live emergency data.
          </p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2 text-xs text-[#82938f]"
        >
          <Settings className="size-4" aria-hidden="true" />
          Simulation settings
        </Button>
      </div>
    </aside>
  );
}

type SummaryState = {
  locationKnown: boolean;
  floodObserved: boolean;
  trendKnown: boolean;
  depthKnown: boolean;
  closureKnown: boolean;
  barriersKnown: boolean;
};

type StreamController = ReturnType<typeof useAssemblyAIStream>;

function LiveOperationsPanel({
  stage,
  revealedWords,
  playingReport,
  onPlayReport,
  summary,
  briefingVisible,
  onSpeakBriefing,
  stream,
}: {
  stage: StreamStage;
  revealedWords: number;
  playingReport: ReportId | null;
  onPlayReport: (report: Report) => void;
  summary: SummaryState;
  briefingVisible: boolean;
  onSpeakBriefing: () => void;
  stream: StreamController;
}) {
  const activeReport =
    stage === 'public' ? publicReport : stage === 'field' ? fieldReport : null;

  return (
    <aside className="border-t border-white/8 bg-[#0b1113] lg:border-l lg:border-t-0">
      <div className="flex h-12 items-center border-b border-white/8 px-4">
        <Headphones className="mr-2 size-4 text-[#d79b39]" aria-hidden="true" />
        <h2 className="text-xs font-semibold">Live crisis stream</h2>
        <Badge
          className={`ml-auto font-mono text-[9px] ${
            activeReport
              ? 'bg-[#4dbb91]/12 text-[#78d0ae]'
              : 'bg-white/7 text-[#9baba7]'
          }`}
        >
          {activeReport ? 'LIVE' : stage === 'complete' ? 'COMPLETE' : 'READY'}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        <LiveTranscriptCard
          report={publicReport}
          active={stage === 'public'}
          complete={stage === 'field' || stage === 'complete'}
          revealedWords={stage === 'public' ? revealedWords : 0}
          playing={playingReport === 'public'}
          onPlay={onPlayReport}
        />

        {(stage === 'field' || stage === 'complete') && (
          <LiveTranscriptCard
            report={fieldReport}
            active={stage === 'field'}
            complete={stage === 'complete'}
            revealedWords={stage === 'field' ? revealedWords : 0}
            playing={playingReport === 'field'}
            onPlay={onPlayReport}
          />
        )}

        <LiveSummary summary={summary} stage={stage} />

        {stage === 'complete' && (
          <BriefingPanel visible={briefingVisible} onSpeak={onSpeakBriefing} />
        )}

        <LiveMicrophone stream={stream} />
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
  report: Report;
  active: boolean;
  complete: boolean;
  revealedWords: number;
  playing: boolean;
  onPlay: (report: Report) => void;
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
          <div className="min-h-[88px] border-t border-white/8 p-3">
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.11em] text-[#6f807c]">
              <span
                className={`size-1.5 rounded-full ${active ? 'animate-pulse bg-[#65c9a3]' : 'bg-[#667773]'}`}
                aria-hidden="true"
              />
              Live transcript
            </div>
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
  summary,
  stage,
}: {
  summary: SummaryState;
  stage: StreamStage;
}) {
  const rows = [
    [
      'Location',
      summary.locationKnown ? 'Ben Thuy Bridge 1, north approach' : 'Listening',
    ],
    ['Water', summary.floodObserved ? 'Moving across roadway' : 'Listening'],
    [
      'Trend',
      summary.trendKnown ? 'Rising, caller observed' : 'Not established',
    ],
    [
      'Depth',
      summary.depthKnown
        ? '35 cm'
        : summary.floodObserved
          ? 'Unknown'
          : 'Not established',
    ],
    ['Access', summary.closureKnown ? 'Impassable' : 'Not established'],
    ['Barriers', summary.barriersKnown ? 'In place' : 'Not established'],
  ];
  const live = stage === 'public' || stage === 'field';

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
            className="grid grid-cols-[72px_1fr] gap-2 py-2 text-[11px]"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#697a76]">
              {label}
            </span>
            <span
              className={`transition-colors ${
                value === 'Listening'
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
      <p className="mt-3 font-mono text-[9px] leading-relaxed text-[#70817d]">
        Summary fields remain linked to their source transcript and update as
        new audio arrives.
      </p>
    </section>
  );
}

function BriefingPanel({
  visible,
  onSpeak,
}: {
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
          <p className="text-[11px] leading-relaxed text-[#c8d5d1]">
            Ben Thuy Bridge 1 is impassable on the northern approach. Road Team
            3 reported approximately 35 cm of moving water with barriers in
            place. Use Vinh University as the staging destination and confirm an
            alternate route with coordination.
          </p>
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

function LiveMicrophone({ stream }: { stream: StreamController }) {
  const listening = stream.state === 'listening';
  const transcript = stream.finalTranscript || stream.partialTranscript;

  return (
    <section className="border-t border-white/8 pt-3">
      <div className="flex items-center gap-2">
        <Mic
          className={`size-3.5 ${listening ? 'text-[#65c9a3]' : 'text-[#71827e]'}`}
          aria-hidden="true"
        />
        <h3 className="text-[11px] font-medium">Optional live English STT</h3>
        <Badge className="ml-auto bg-white/6 font-mono text-[9px] text-[#788985]">
          U3 PRO
        </Badge>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#687975]">
        Uses AssemblyAI Universal-3 Pro Streaming when a server-side API key is
        configured.
      </p>
      {transcript && (
        <p
          className="mt-2 rounded-md bg-black/20 p-2 text-[11px] leading-relaxed text-[#bdcac6]"
          aria-live="polite"
        >
          {transcript}
        </p>
      )}
      {stream.error && (
        <p
          className="mt-2 text-[10px] leading-relaxed text-[#d7a95f]"
          role="alert"
        >
          {stream.error}
        </p>
      )}
      <Button
        size="sm"
        variant="outline"
        className="mt-2 w-full border-white/10 bg-white/[0.025] text-[#aebdb9]"
        onClick={listening ? stream.stop : stream.start}
      >
        {listening ? (
          <Pause className="size-3.5" aria-hidden="true" />
        ) : (
          <Mic className="size-3.5" aria-hidden="true" />
        )}
        {listening
          ? 'Stop microphone'
          : stream.state === 'connecting'
            ? 'Connecting'
            : 'Start live mic'}
      </Button>
    </section>
  );
}

function TrackedPlaces({
  selectedLocation,
  onSelect,
}: {
  selectedLocation: LocationId;
  onSelect: (location: LocationId) => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.11em] text-[#70817d]">
        <Route className="size-3.5" aria-hidden="true" />
        Tracked places
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(landmarks) as LocationId[]).map((id) => {
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
  isBridge,
}: {
  status: 'idle' | 'reported' | 'verified';
  isBridge: boolean;
}) {
  if (!isBridge) {
    return <Badge className="bg-white/7 text-[#9baba7]">Reference place</Badge>;
  }
  if (status === 'verified') {
    return (
      <Badge className="border-[#dd644c]/35 bg-[#dd644c]/12 text-[#ef8f7c]">
        Impassable · 35 cm
      </Badge>
    );
  }
  if (status === 'reported') {
    return (
      <Badge className="border-[#3b91aa]/35 bg-[#3b91aa]/12 text-[#9ed5e2]">
        Flooding detected
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
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#63736f]">
        {label}
      </p>
      <p className="mt-1 flex items-center gap-2 text-xs font-medium text-[#cbd5d2]">
        {live && (
          <span
            className="size-1.5 animate-pulse rounded-full bg-[#65c9a3]"
            aria-hidden="true"
          />
        )}
        {value}
      </p>
    </div>
  );
}
