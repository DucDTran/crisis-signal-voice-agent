'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type TranscriptTurn = {
  id: string;
  text: string;
};

type StreamState = 'idle' | 'connecting' | 'listening' | 'error';
export type FixturePlaybackState = 'idle' | 'playing' | 'paused' | 'ended';

type TokenResponse = {
  available: boolean;
  token?: string;
  error?: string;
};

type TurnMessage = {
  type: string;
  transcript?: string;
  end_of_turn?: boolean;
};

type FixtureOptions = {
  callId: string;
  initialTurns?: TranscriptTurn[];
  startAt?: number;
};

type FixtureResources = {
  audio: HTMLAudioElement;
};

const KEY_TERMS = [
  'Vinh City',
  'Ben Thuy Bridge 1',
  'Vinh Railway Station',
  'Vinh Market',
  'Vinh University',
  'Nui Quyet',
  'Nghe An General Friendship Hospital',
  'Vinh International Airport',
  'Road Team 3',
  'disaster prevention command',
];

function streamingSocketUrl(token: string) {
  const socketUrl = new URL('wss://streaming.assemblyai.com/v3/ws');
  socketUrl.searchParams.set('token', token);
  socketUrl.searchParams.set('sample_rate', '16000');
  socketUrl.searchParams.set('speech_model', 'u3-rt-pro');
  socketUrl.searchParams.set(
    'prompt',
    'Transcribe English emergency calls accurately. Preserve measurements, place names, negation, uncertainty, and whether a fact is reported or confirmed.',
  );
  socketUrl.searchParams.set('keyterms_prompt', JSON.stringify(KEY_TERMS));
  return socketUrl;
}

function resamplePcm(
  channel: Float32Array,
  start: number,
  end: number,
  sourceRate: number,
) {
  const sourceLength = Math.max(0, end - start);
  const targetLength = Math.max(
    1,
    Math.floor((sourceLength * 16_000) / sourceRate),
  );
  const pcm = new Int16Array(targetLength);
  for (let index = 0; index < targetLength; index += 1) {
    const sourceIndex = Math.min(
      channel.length - 1,
      start + Math.floor((index * sourceLength) / targetLength),
    );
    pcm[index] = Math.round(
      Math.max(-1, Math.min(1, channel[sourceIndex] ?? 0)) * 0x7fff,
    );
  }
  return pcm;
}

export function useAssemblyAIStream() {
  const [state, setState] = useState<StreamState>('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [finalTurns, setFinalTurns] = useState<string[]>([]);
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptTurn[]>([]);
  const [error, setError] = useState('');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] =
    useState<FixturePlaybackState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const fixtureRef = useRef<FixtureResources | null>(null);

  const cleanup = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    fixtureRef.current = null;
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setState('idle');
    setPlaybackState('idle');
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setPartialTranscript('');
    setFinalTranscript('');
    setFinalTurns([]);
    setTranscriptTurns([]);
    setError('');
    setActiveCallId(null);
    setPlaybackState('idle');
    setCurrentTime(0);
    setDuration(0);
  }, [cleanup]);

  const start = useCallback(async () => {
    reset();
    setState('connecting');

    try {
      const tokenResponse = await fetch('/api/assemblyai-token', {
        cache: 'no-store',
      });
      const tokenBody = (await tokenResponse.json()) as TokenResponse;
      if (!tokenResponse.ok || !tokenBody.token) {
        throw new Error(
          tokenBody.error ?? 'Live transcription is unavailable.',
        );
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const audioContext = new AudioContext();
      await audioContext.audioWorklet.addModule('/pcm-processor.js');
      const source = audioContext.createMediaStreamSource(mediaStream);
      const worklet = new AudioWorkletNode(audioContext, 'flood-signal-pcm');
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      source.connect(worklet);
      worklet.connect(silentGain);
      silentGain.connect(audioContext.destination);

      const socket = new WebSocket(streamingSocketUrl(tokenBody.token));
      let socketReady = false;
      let turnIndex = 0;

      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (socketReady && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };

      socket.addEventListener('open', () => {
        socketReady = true;
        setState('listening');
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as TurnMessage;
        if (message.type !== 'Turn' || !message.transcript) return;
        setPartialTranscript(message.transcript);
        if (!message.end_of_turn) return;
        const text = message.transcript.trim();
        setTranscriptTurns((current) => [
          ...current,
          { id: `microphone-${turnIndex}`, text },
        ]);
        turnIndex += 1;
        setFinalTurns((current) => [...current, text]);
        setFinalTranscript((current) =>
          current ? `${current} ${text}` : text,
        );
        setPartialTranscript('');
      });
      socket.addEventListener('error', () => {
        setError('The streaming connection was interrupted.');
        setState('error');
      });

      cleanupRef.current = () => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'Terminate' }));
        }
        socket.close();
        worklet.disconnect();
        source.disconnect();
        silentGain.disconnect();
        for (const track of mediaStream.getTracks()) track.stop();
        void audioContext.close();
      };
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Live transcription could not start.',
      );
      setState('error');
    }
  }, [reset]);

  const startFixture = useCallback(
    async (audioUrl: string, options: FixtureOptions) => {
      reset();
      const initialTurns = options.initialTurns ?? [];
      const initialTranscript = initialTurns.map((turn) => turn.text).join(' ');
      setActiveCallId(options.callId);
      setTranscriptTurns(initialTurns);
      setFinalTurns(initialTurns.map((turn) => turn.text));
      setFinalTranscript(initialTranscript);
      setState('connecting');

      try {
        const [tokenResponse, audioData] = await Promise.all([
          fetch('/api/assemblyai-token', { cache: 'no-store' }),
          fetch(audioUrl).then((response) => {
            if (!response.ok) {
              throw new Error('Synthetic call audio could not be loaded.');
            }
            return response.arrayBuffer();
          }),
        ]);
        const tokenBody = (await tokenResponse.json()) as TokenResponse;
        if (!tokenResponse.ok || !tokenBody.token) {
          throw new Error(
            tokenBody.error ?? 'Live transcription is unavailable.',
          );
        }

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(
          audioData.slice(0),
        );
        const channel = audioBuffer.getChannelData(0);
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        const socket = new WebSocket(streamingSocketUrl(tokenBody.token));
        let socketReady = false;
        const startAt = Math.min(
          Math.max(options.startAt ?? 0, 0),
          Math.max(0, audioBuffer.duration - 0.05),
        );
        let offset = Math.floor(startAt * audioBuffer.sampleRate);
        let turnIndex = initialTurns.length;
        let sendTimer: number | null = null;
        let finishTimer: number | null = null;
        let shuttingDown = false;

        setDuration(audioBuffer.duration);
        setCurrentTime(startAt);
        audio.currentTime = startAt;

        const sendThroughPlaybackPosition = () => {
          if (!socketReady || socket.readyState !== WebSocket.OPEN) return;
          setCurrentTime(audio.currentTime);
          const desiredOffset = Math.min(
            channel.length,
            Math.floor(audio.currentTime * audioBuffer.sampleRate),
          );
          if (desiredOffset <= offset) return;
          socket.send(
            resamplePcm(channel, offset, desiredOffset, audioBuffer.sampleRate)
              .buffer,
          );
          offset = desiredOffset;
        };

        const terminateAfterFinalAudio = () => {
          if (shuttingDown) return;
          shuttingDown = true;
          if (channel.length > offset && socket.readyState === WebSocket.OPEN) {
            socket.send(
              resamplePcm(
                channel,
                offset,
                channel.length,
                audioBuffer.sampleRate,
              ).buffer,
            );
            offset = channel.length;
          }
          finishTimer = window.setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'Terminate' }));
            }
          }, 1_400);
        };

        const onPlay = () => {
          setPlaybackState('playing');
          setState('listening');
        };
        const onPause = () => {
          if (!audio.ended && !shuttingDown) setPlaybackState('paused');
        };
        const onEnded = () => {
          setCurrentTime(audio.duration || audioBuffer.duration);
          setPlaybackState('ended');
          terminateAfterFinalAudio();
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);

        socket.addEventListener('open', () => {
          socketReady = true;
          setState('listening');
          sendTimer = window.setInterval(sendThroughPlaybackPosition, 80);
          void audio.play().catch(() => {
            setPlaybackState('paused');
            setError(
              'Audio is ready. Press play once more to begin this call.',
            );
          });
        });
        socket.addEventListener('message', (event) => {
          const message = JSON.parse(String(event.data)) as TurnMessage;
          if (message.type !== 'Turn' || !message.transcript) return;
          setPartialTranscript(message.transcript);
          if (!message.end_of_turn) return;
          const text = message.transcript.trim();
          setTranscriptTurns((current) => [
            ...current,
            { id: `${options.callId}-${turnIndex}`, text },
          ]);
          setFinalTurns((current) => [...current, text]);
          setFinalTranscript((current) =>
            current ? `${current} ${text}` : text,
          );
          turnIndex += 1;
          setPartialTranscript('');
        });
        socket.addEventListener('error', () => {
          setError('AssemblyAI lost the synthetic call stream.');
          setState('error');
        });
        socket.addEventListener('close', () => {
          setState((current) => (current === 'error' ? current : 'idle'));
        });

        fixtureRef.current = { audio };
        cleanupRef.current = () => {
          shuttingDown = true;
          if (sendTimer) window.clearInterval(sendTimer);
          if (finishTimer) window.clearTimeout(finishTimer);
          audio.removeEventListener('play', onPlay);
          audio.removeEventListener('pause', onPause);
          audio.removeEventListener('ended', onEnded);
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'Terminate' }));
          }
          socket.close();
          void audioContext.close();
        };
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'The synthetic call could not be transcribed.',
        );
        setState('error');
        setPlaybackState('idle');
      }
    },
    [reset],
  );

  const pauseFixture = useCallback(() => {
    fixtureRef.current?.audio.pause();
  }, []);

  const resumeFixture = useCallback(async () => {
    const audio = fixtureRef.current?.audio;
    if (!audio) return;
    setError('');
    await audio.play();
  }, []);

  const toggleFixture = useCallback(async () => {
    if (playbackState === 'playing') {
      pauseFixture();
      return;
    }
    await resumeFixture();
  }, [pauseFixture, playbackState, resumeFixture]);

  useEffect(() => cleanup, [cleanup]);

  return {
    state,
    error,
    partialTranscript,
    finalTranscript,
    finalTurns,
    transcriptTurns,
    activeCallId,
    playbackState,
    currentTime,
    duration,
    start,
    startFixture,
    pauseFixture,
    resumeFixture,
    toggleFixture,
    stop,
    reset,
  };
}
