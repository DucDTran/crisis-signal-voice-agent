'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Speaker = 'reporter' | 'operator' | 'field';
type SpeechState = 'idle' | 'loading' | 'playing' | 'error';

export function useGradiumTts() {
  const [state, setState] = useState<SpeechState>('idle');
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
    setState('idle');
  }, []);

  const speak = useCallback(
    async (text: string, speaker: Speaker = 'operator') => {
      stop();
      setError('');
      setState('loading');

      try {
        const response = await fetch('/api/gradium-tts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text, speaker }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? 'Gradium speech synthesis failed.');
        }

        const url = URL.createObjectURL(await response.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        objectUrlRef.current = url;
        audio.onplay = () => setState('playing');
        audio.onended = () => {
          audioRef.current = null;
          if (objectUrlRef.current === url) {
            URL.revokeObjectURL(url);
            objectUrlRef.current = null;
          }
          setState('idle');
        };
        audio.onerror = () => {
          setError('The generated audio could not be played.');
          setState('error');
        };
        await audio.play();
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Gradium speech synthesis failed.',
        );
        setState('error');
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { state, error, speak, stop };
}
