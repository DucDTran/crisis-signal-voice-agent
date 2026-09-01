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
  const [error, setError] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    stop();
    setError('');
    setPartialTranscript('');
    setFinalTranscript('');
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
      socketUrl.searchParams.set('speech_model', 'whisper-rt');
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

  useEffect(() => stop, [stop]);

  return { state, partialTranscript, finalTranscript, error, start, stop };
}
