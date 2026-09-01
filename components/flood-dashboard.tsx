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
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
  Volume2,
  Waves,
} from 'lucide-react';
import { useEffect, useState } from 'react';

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

type ExercisePhase = 'reported' | 'processing' | 'review' | 'verified';
type ReportId = 'public' | 'field';

const publicReport = {
  title: 'Public report 01',
  source: 'VI · MOBILE · 00:18',
  vietnamese:
    'Tôi đang ở gần cầu Bến Thủy 1, phía thành phố Vinh. Nước đang tràn qua đường dẫn phía bắc. Tôi vừa đi qua khoảng năm phút trước. Nước có vẻ vẫn đang dâng, nhưng tôi không rõ sâu bao nhiêu.',
  english:
    'I am near Ben Thuy Bridge 1 on the Vinh side. Water is crossing the northern approach. I passed about five minutes ago. It still seems to be rising, but I do not know the depth.',
};

const fieldReport = {
  title: 'Road team radio 03',
  source: 'VI · RADIO · 00:21',
  vietnamese:
    'Tổ đường bộ 3 báo về trung tâm. Cập nhật tại đường dẫn phía bắc cầu Bến Thủy 1 lúc 11 giờ 18. Nước chảy sâu khoảng 35 xăng-ti-mét. Tuyến đường không thể lưu thông. Đã đặt rào chắn. Chưa ghi nhận hư hỏng mặt đường.',
  english:
    'Road Team 3 reporting. Update for the northern approach to Ben Thuy Bridge 1 at 11:18. Moving water is approximately 35 centimetres deep. The route is impassable. Barriers are in place. No road surface damage is reported.',
};

const landmarks: Record<
  LocationId,
  { name: string; english: string; meta: string }
> = {
  bridge: {
    name: 'Cầu Bến Thủy 1',
    english: 'Ben Thuy Bridge 1',
    meta: 'Northern approach, Vinh side',
  },
  station: {
    name: 'Ga Vinh',
    english: 'Vinh Railway Station',
    meta: 'Transport hub',
  },
  market: {
    name: 'Chợ Vinh',
    english: 'Vinh Market',
    meta: 'Community landmark',
  },
  university: {
    name: 'Đại học Vinh',
    english: 'Vinh University',
    meta: 'Relief staging destination',
  },
};

const navItems = [
  { label: 'Operations', icon: Activity, active: true },
  { label: 'Incident map', icon: Map },
  { label: 'Voice reports', icon: AudioLines },
  { label: 'Response teams', icon: Users },
  { label: 'Data sources', icon: Database },
];

export function FloodDashboard() {
  const [phase, setPhase] = useState<ExercisePhase>('reported');
  const [selectedLocation, setSelectedLocation] =
    useState<LocationId>('bridge');
  const [playingReport, setPlayingReport] = useState<ReportId | null>(null);
  const [briefingVisible, setBriefingVisible] = useState(false);
  const stream = useAssemblyAIStream();
  const selected = landmarks[selectedLocation];
  const isVerified = phase === 'verified';

  useEffect(() => {
    if (phase !== 'processing') return;
    const timer = window.setTimeout(() => setPhase('review'), 1700);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  function speakReport(id: ReportId) {
    if (!('speechSynthesis' in window)) return;
    if (playingReport === id) {
      window.speechSynthesis.cancel();
      setPlayingReport(null);
      return;
    }

    window.speechSynthesis.cancel();
    const report = id === 'public' ? publicReport : fieldReport;
    const utterance = new SpeechSynthesisUtterance(report.vietnamese);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.94;
    utterance.onend = () => setPlayingReport(null);
    utterance.onerror = () => setPlayingReport(null);
    setPlayingReport(id);
    window.speechSynthesis.speak(utterance);
  }

  function speakBriefing() {
    setBriefingVisible(true);
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      'No. Do not route relief vehicles across Ben Thuy Bridge 1. The northern approach is field verified closed, with approximately 35 centimetres of moving water. Use Vinh University as the staging destination and confirm an alternate route with command.',
    );
    utterance.lang = 'en-US';
    utterance.rate = 0.94;
    window.speechSynthesis.speak(utterance);
  }

  function advanceDemo() {
    if (phase === 'reported') {
      setSelectedLocation('bridge');
      setPhase('processing');
      return;
    }
    if (phase === 'review') {
      setPhase('verified');
      return;
    }
    if (phase === 'verified') speakBriefing();
  }

  function resetExercise() {
    window.speechSynthesis?.cancel();
    stream.stop();
    setPhase('reported');
    setSelectedLocation('bridge');
    setPlayingReport(null);
    setBriefingVisible(false);
  }

  const demoAction =
    phase === 'reported'
      ? 'Process field update'
      : phase === 'processing'
        ? 'Transcribing report'
        : phase === 'review'
          ? 'Verify and update map'
          : 'Play route briefing';

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
                Voice to map operations
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Badge className="hidden border-[#d79b39]/30 bg-[#d79b39]/10 font-mono text-[10px] uppercase tracking-[0.08em] text-[#e6b35f] sm:inline-flex">
              Fictional exercise
            </Badge>
            <Button
              size="sm"
              onClick={advanceDemo}
              disabled={phase === 'processing'}
              className="min-w-[154px] bg-[#d79b39] text-[#1d160b] hover:bg-[#e9ae4c]"
            >
              {phase === 'processing' ? (
                <LoaderCircle
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : isVerified ? (
                <Volume2 className="size-3.5" aria-hidden="true" />
              ) : (
                <Play className="size-3.5" aria-hidden="true" />
              )}
              {demoAction}
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Reset exercise"
                    onClick={resetExercise}
                  />
                }
              >
                <RefreshCw className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Reset exercise</TooltipContent>
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

        <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 lg:grid-cols-[208px_minmax(0,1fr)_370px]">
          <Sidebar />

          <section className="min-w-0 bg-[#0e1517]">
            <div className="flex min-h-[76px] flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3 lg:px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${isVerified ? 'bg-[#dd644c] shadow-[0_0_0_4px_rgb(221_100_76/13%)]' : 'bg-[#d79b39] shadow-[0_0_0_4px_rgb(215_155_57/12%)]'}`}
                    aria-hidden="true"
                  />
                  <h1 className="truncate text-sm font-semibold">
                    Vinh flood response exercise
                  </h1>
                </div>
                <p className="mt-1 pl-4 text-xs text-[#7f918d]">
                  Voice reports update a shared operational picture in real
                  time.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-[#7c8d89]">
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {isVerified ? '18' : '06'} min elapsed
                </span>
                <span className="hidden items-center gap-1.5 sm:flex">
                  <ShieldCheck
                    className="size-3.5 text-[#4dbb91]"
                    aria-hidden="true"
                  />
                  Audit trail on
                </span>
              </div>
            </div>

            <div className="grid min-h-[calc(100dvh-8.75rem)] grid-rows-[minmax(390px,1fr)_auto]">
              <VinhMap
                status={isVerified ? 'verified' : 'reported'}
                selectedLocation={selectedLocation}
                onSelectLocation={setSelectedLocation}
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
                    <p className="text-xs text-[#899a96]">
                      {selected.english} · {selected.meta}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      verified={isVerified}
                      isBridge={selectedLocation === 'bridge'}
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
                    label="Reported depth"
                    value={isVerified ? '35 cm moving water' : 'Unknown'}
                  />
                  <Metric
                    label="Route state"
                    value={
                      isVerified
                        ? 'Closed, field verified'
                        : 'Unknown, low confidence'
                    }
                  />
                  <Metric
                    label="Last changed"
                    value={isVerified ? '11:18:42' : '11:06:24'}
                  />
                </div>

                {isVerified && (
                  <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.11em] text-[#70817d]">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      Evidence timeline
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <TimelineEvent
                        time="11:06"
                        title="Public report received"
                        detail="Possible flooding. Depth and passability unknown."
                        tone="reported"
                      />
                      <TimelineEvent
                        time="11:18"
                        title="Road team update approved"
                        detail="35 cm moving water. Impassable. Barriers placed."
                        tone="verified"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <VoicePanel
            phase={phase}
            playingReport={playingReport}
            briefingVisible={briefingVisible}
            onPlayReport={speakReport}
            onAdvance={advanceDemo}
            onSpeakBriefing={speakBriefing}
            stream={stream}
            onUseLiveTranscript={() => setPhase('review')}
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
            Ingestion active
          </div>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-[#667773]">
            1 simulated channel connected. No live emergency data.
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

type StreamController = ReturnType<typeof useAssemblyAIStream>;

function VoicePanel({
  phase,
  playingReport,
  briefingVisible,
  onPlayReport,
  onAdvance,
  onSpeakBriefing,
  stream,
  onUseLiveTranscript,
}: {
  phase: ExercisePhase;
  playingReport: ReportId | null;
  briefingVisible: boolean;
  onPlayReport: (id: ReportId) => void;
  onAdvance: () => void;
  onSpeakBriefing: () => void;
  stream: StreamController;
  onUseLiveTranscript: () => void;
}) {
  const hasFieldReport = phase !== 'reported';

  return (
    <aside className="border-t border-white/8 bg-[#0b1113] lg:border-l lg:border-t-0">
      <div className="flex h-12 items-center border-b border-white/8 px-4">
        <Headphones className="mr-2 size-4 text-[#d79b39]" aria-hidden="true" />
        <h2 className="text-xs font-semibold">Live voice queue</h2>
        <Badge className="ml-auto bg-white/7 text-[#9baba7]">
          {hasFieldReport ? '2 reports' : '1 report'}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        <ReportCard
          id="public"
          report={publicReport}
          playing={playingReport === 'public'}
          onPlay={onPlayReport}
          compact={hasFieldReport}
        />

        {phase === 'processing' && (
          <div
            className="rounded-md border border-[#d79b39]/25 bg-[#11191b] p-4"
            aria-live="polite"
          >
            <div className="flex items-center gap-3">
              <LoaderCircle
                className="size-5 animate-spin text-[#d79b39]"
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-medium">Transcribing field radio</p>
                <p className="mt-1 font-mono text-[10px] text-[#758681]">
                  ASSEMBLYAI STREAMING · WHISPER RT
                </p>
              </div>
            </div>
            <div className="waveform mt-2" aria-hidden="true">
              {Array.from({ length: 38 }, (_, index) => (
                <span
                  key={index}
                  className="animate-pulse"
                  style={{
                    height: `${8 + ((index * 17) % 27)}px`,
                    animationDelay: `${index * 25}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {(phase === 'review' || phase === 'verified') && (
          <ReportCard
            id="field"
            report={fieldReport}
            playing={playingReport === 'field'}
            onPlay={onPlayReport}
            verified={phase === 'verified'}
          />
        )}

        {phase === 'reported' && <ReviewNotice onAdvance={onAdvance} />}

        {phase === 'review' && <StructuredReview onApprove={onAdvance} />}

        {phase === 'verified' && (
          <BriefingPanel visible={briefingVisible} onSpeak={onSpeakBriefing} />
        )}

        <LiveTranscription
          stream={stream}
          onUseTranscript={onUseLiveTranscript}
        />
      </div>
    </aside>
  );
}

function ReportCard({
  id,
  report,
  playing,
  onPlay,
  compact = false,
  verified = false,
}: {
  id: ReportId;
  report: typeof publicReport;
  playing: boolean;
  onPlay: (id: ReportId) => void;
  compact?: boolean;
  verified?: boolean;
}) {
  return (
    <article
      className={`overflow-hidden rounded-md border bg-[#11191b] ${verified ? 'border-[#4dbb91]/28' : 'border-[#d79b39]/25'}`}
    >
      <div className="flex items-center gap-3 border-b border-white/8 px-3 py-3">
        <button
          type="button"
          onClick={() => onPlay(id)}
          className="grid size-8 shrink-0 place-items-center rounded-md bg-[#d79b39] text-[#191309] transition-colors hover:bg-[#ebb760] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d79b39] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11191b]"
          aria-label={`${playing ? 'Pause' : 'Play'} simulated ${report.title}`}
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
          className={`font-mono text-[9px] ${verified ? 'text-[#65c9a3]' : 'text-[#d9a950]'}`}
        >
          {verified ? 'VERIFIED' : 'TRANSCRIBED'}
        </span>
      </div>
      {!compact && (
        <>
          <div className="waveform" aria-hidden="true">
            {Array.from({ length: 38 }, (_, index) => (
              <span
                key={index}
                style={{ height: `${8 + ((index * 13) % 25)}px` }}
              />
            ))}
          </div>
          <div className="border-t border-white/8 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6f807c]">
              Transcript and translation
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[#cad5d2]">
              “{report.vietnamese}”
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#768783]">
              “{report.english}”
            </p>
          </div>
        </>
      )}
    </article>
  );
}

function ReviewNotice({ onAdvance }: { onAdvance: () => void }) {
  return (
    <div className="rounded-md border border-white/8 bg-white/[0.025] p-3">
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-4 text-[#d79b39]" aria-hidden="true" />
        <p className="text-xs font-medium">Human review required</p>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-[#80918d]">
        Flood depth and passability were not confirmed by the caller. The map
        keeps this report provisional.
      </p>
      <Button
        size="sm"
        className="mt-3 w-full bg-[#d79b39] text-[#1d160b] hover:bg-[#e9ae4c]"
        onClick={onAdvance}
      >
        <Radio className="size-3.5" aria-hidden="true" />
        Ingest field update
      </Button>
    </div>
  );
}

function StructuredReview({ onApprove }: { onApprove: () => void }) {
  const facts = [
    ['Location', 'Northern approach, Ben Thuy Bridge 1'],
    ['Depth', 'Approximately 35 cm'],
    ['Passability', 'Impassable'],
    ['Control', 'Barriers placed'],
  ];

  return (
    <section
      className="animate-in fade-in slide-in-from-bottom-2 rounded-md border border-[#d79b39]/28 bg-[#11191b] p-3 duration-300"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-[#d79b39]" aria-hidden="true" />
        <h3 className="text-xs font-semibold">Approve extracted update</h3>
      </div>
      <div className="mt-3 divide-y divide-white/7 border-y border-white/7">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[88px_1fr] gap-2 py-2 text-[11px]"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-[#697a76]">
              {label}
            </span>
            <span className="text-[#c5d1ce]">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-[#748580]">
        AI suggests the change. A human operator remains the source of truth.
      </p>
      <Button
        size="sm"
        className="mt-3 w-full bg-[#d79b39] text-[#1d160b] hover:bg-[#e9ae4c]"
        onClick={onApprove}
      >
        <Check className="size-3.5" aria-hidden="true" />
        Verify and update map
      </Button>
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
    <section className="animate-in fade-in slide-in-from-bottom-2 rounded-md border border-[#4dbb91]/24 bg-[#101a19] p-3 duration-300">
      <div className="flex items-center gap-2">
        <Volume2 className="size-4 text-[#65c9a3]" aria-hidden="true" />
        <h3 className="text-xs font-semibold">Verified-only voice briefing</h3>
      </div>
      <p className="mt-3 rounded-md bg-black/20 px-3 py-2 text-[11px] text-[#aab8b5]">
        Can a relief vehicle reach Vinh University across Ben Thuy Bridge 1?
      </p>
      {visible && (
        <div
          className="mt-2 animate-in fade-in duration-200"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#65c9a3]">
            <Check className="size-3" aria-hidden="true" />
            route_state.lookup · verified facts only
          </div>
          <p className="text-[11px] leading-relaxed text-[#c8d5d1]">
            No. Do not route relief vehicles across Ben Thuy Bridge 1. The
            northern approach is field-verified closed, with approximately 35 cm
            of moving water. Use Vinh University as the staging destination and
            confirm an alternate route with command.
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
        {visible ? 'Replay spoken briefing' : 'Generate spoken briefing'}
      </Button>
    </section>
  );
}

function LiveTranscription({
  stream,
  onUseTranscript,
}: {
  stream: StreamController;
  onUseTranscript: () => void;
}) {
  const listening = stream.state === 'listening';
  const transcript = stream.finalTranscript || stream.partialTranscript;

  return (
    <section className="border-t border-white/8 pt-3">
      <div className="flex items-center gap-2">
        <Mic
          className={`size-3.5 ${listening ? 'text-[#65c9a3]' : 'text-[#71827e]'}`}
          aria-hidden="true"
        />
        <h3 className="text-[11px] font-medium">
          Optional live Vietnamese STT
        </h3>
        <Badge className="ml-auto bg-white/6 font-mono text-[9px] text-[#788985]">
          WHISPER RT
        </Badge>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-[#687975]">
        Uses AssemblyAI Streaming when a server-side API key is configured. The
        guided replay always works.
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
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-white/10 bg-white/[0.025] text-[#aebdb9]"
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
        {stream.finalTranscript && (
          <Button
            size="sm"
            onClick={onUseTranscript}
            className="bg-[#d79b39] text-[#1d160b] hover:bg-[#e9ae4c]"
          >
            Review
          </Button>
        )}
      </div>
    </section>
  );
}

function StatusBadge({
  verified,
  isBridge,
}: {
  verified: boolean;
  isBridge: boolean;
}) {
  if (!isBridge)
    return <Badge className="bg-white/7 text-[#9baba7]">Reference place</Badge>;
  return verified ? (
    <Badge className="border-[#dd644c]/35 bg-[#dd644c]/12 text-[#ef8f7c]">
      Verified closure
    </Badge>
  ) : (
    <Badge className="border-[#d79b39]/30 bg-[#d79b39]/10 text-[#edbc6a]">
      Unverified report
    </Badge>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#101719] px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#63736f]">
        {label}
      </p>
      <p className="mt-1 text-xs font-medium text-[#cbd5d2]">{value}</p>
    </div>
  );
}

function TimelineEvent({
  time,
  title,
  detail,
  tone,
}: {
  time: string;
  title: string;
  detail: string;
  tone: 'reported' | 'verified';
}) {
  return (
    <article className="flex gap-3 rounded-md border border-white/8 bg-[#101719] p-3">
      <span
        className={`mt-1 size-2 shrink-0 rounded-full ${tone === 'verified' ? 'bg-[#4dbb91]' : 'bg-[#d79b39]'}`}
        aria-hidden="true"
      />
      <div>
        <p className="text-xs font-medium text-[#cbd5d2]">{title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[#71827e]">
          {time} · {detail}
        </p>
      </div>
    </article>
  );
}
