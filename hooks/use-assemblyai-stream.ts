'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type StreamState = 'idle' | 'connecting' | 'listening' | 'error';

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

export function useAssemblyAIStream() {
  const [state, setState] = useState<StreamState>('idle');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [finalTurns, setFinalTurns] = useState<string[]>([]);
  const [error, setError] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setState('idle');
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setState('idle');
    setPartialTranscript('');
    setFinalTranscript('');
    setFinalTurns([]);
    setError('');
  }, []);

  const start = useCallback(async () => {
    stop();
    setError('');
    setPartialTranscript('');
    setFinalTranscript('');
    setFinalTurns([]);
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

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      const audioContext = new AudioContext();
      await audioContext.audioWorklet.addModule('/pcm-processor.js');
      const source = audioContext.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(audioContext, 'flood-signal-pcm');
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;
      source.connect(worklet);
      worklet.connect(silentGain);
      silentGain.connect(audioContext.destination);

      const socketUrl = new URL('wss://streaming.assemblyai.com/v3/ws');
      socketUrl.searchParams.set('token', tokenBody.token);
      socketUrl.searchParams.set('sample_rate', '16000');
      socketUrl.searchParams.set('speech_model', 'u3-rt-pro');
      socketUrl.searchParams.set(
        'prompt',
        'Transcribe English emergency operations audio accurately. Preserve measurements, times, negation, uncertainty, and whether information is reported or confirmed.',
      );
      socketUrl.searchParams.set(
        'keyterms_prompt',
        JSON.stringify([
          'Vinh City',
          'Ben Thuy Bridge 1',
          'Vinh Railway Station',
          'Vinh Market',
          'Vinh University',
          'Nui Quyet',
          'Road Team 3',
          'disaster prevention command',
        ]),
      );
      const socket = new WebSocket(socketUrl);
      let socketReady = false;

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
        if (message.end_of_turn) {
          setFinalTurns((current) => [...current, message.transcript ?? '']);
          setFinalTranscript((current) =>
            current
              ? `${current} ${message.transcript}`
              : (message.transcript ?? current),
          );
          setPartialTranscript('');
        }
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
        for (const track of stream.getTracks()) track.stop();
        void audioContext.close();
      };
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Live transcription could not start.';
      setError(message);
      setState('error');
    }
  }, [stop]);

  const startFixture = useCallback(async (audioUrl: string) => {
    stop();
    setError('');
    setPartialTranscript('');
    setFinalTranscript('');
    setFinalTurns([]);
    setState('connecting');

    try {
      const tokenResponse = await fetch('/api/assemblyai-token', { cache: 'no-store' });
      const tokenBody = (await tokenResponse.json()) as TokenResponse;
      if (!tokenResponse.ok || !tokenBody.token) {
        throw new Error(tokenBody.error ?? 'Live transcription is unavailable.');
      }

      const audioContext = new AudioContext();
      const audioData = await fetch(audioUrl).then((response) => {
        if (!response.ok) throw new Error('Audio fixture could not be loaded.');
        return response.arrayBuffer();
      });
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const channel = audioBuffer.getChannelData(0);
      const socketUrl = new URL('wss://streaming.assemblyai.com/v3/ws');
      socketUrl.searchParams.set('token', tokenBody.token);
      socketUrl.searchParams.set('sample_rate', '16000');
      socketUrl.searchParams.set('speech_model', 'u3-rt-pro');
      socketUrl.searchParams.set('prompt', 'Transcribe English emergency operations audio accurately. Preserve measurements, times, negation, uncertainty, and whether information is reported or confirmed.');
      socketUrl.searchParams.set('keyterms_prompt', JSON.stringify(['Vinh City', 'Ben Thuy Bridge 1', 'Vinh Railway Station', 'Vinh Market', 'Vinh University', 'Nui Quyet', 'Road Team 3', 'disaster prevention command']));
      const socket = new WebSocket(socketUrl);
      let socketReady = false;
      let offset = 0;
      let sendTimer: number | null = null;
      let finishTimer: number | null = null;

      const sendChunk = () => {
        if (!socketReady || socket.readyState !== WebSocket.OPEN) return;
        const sourceRate = audioBuffer.sampleRate;
        const sourceChunkSize = Math.max(1, Math.floor(sourceRate / 10));
        const end = Math.min(channel.length, offset + sourceChunkSize);
        const targetLength = Math.max(1, Math.floor(((end - offset) * 16000) / sourceRate));
        const pcm = new Int16Array(targetLength);
        for (let index = 0; index < targetLength; index += 1) {
          const sourceIndex = Math.min(channel.length - 1, offset + Math.floor((index * (end - offset)) / targetLength));
          pcm[index] = Math.max(-1, Math.min(1, channel[sourceIndex])) * 0x7fff;
        }
        socket.send(pcm.buffer);
        offset = end;
        if (offset >= channel.length) {
          if (sendTimer) window.clearInterval(sendTimer);
          sendTimer = null;
          finishTimer = window.setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'Terminate' }));
          }, 1200);
        }
      };

      socket.addEventListener('open', () => {
        socketReady = true;
        setState('listening');
        sendChunk();
        sendTimer = window.setInterval(sendChunk, 100);
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as TurnMessage;
        if (message.type !== 'Turn' || !message.transcript) return;
        setPartialTranscript(message.transcript);
        if (message.end_of_turn) {
          setFinalTurns((current) => [...current, message.transcript ?? '']);
          setFinalTranscript((current) => current ? `${current} ${message.transcript}` : (message.transcript ?? current));
          setPartialTranscript('');
        }
      });
      socket.addEventListener('error', () => {
        setError('The fixture streaming connection was interrupted.');
        setState('error');
      });
      socket.addEventListener('close', () => {
        setState((current) => current === 'error' ? current : 'idle');
      });

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      const gain = audioContext.createGain();
      gain.gain.value = 0.9;
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start();

      cleanupRef.current = () => {
        if (sendTimer) window.clearInterval(sendTimer);
        if (finishTimer) window.clearTimeout(finishTimer);
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'Terminate' }));
        socket.close();
        source.stop();
        source.disconnect();
        gain.disconnect();
        void audioContext.close();
      };
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Audio fixture could not start.';
      setError(message);
      setState('error');
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return {
    state,
    partialTranscript,
    finalTranscript,
    finalTurns,
    error,
    start,
    stop,
    reset,
    startFixture,
  };
}
