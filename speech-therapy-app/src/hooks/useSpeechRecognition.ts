import { useEffect, useRef, useState, useCallback } from 'react';

interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionAlternative { transcript: string; }
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Thin React wrapper around the Web Speech API for live, on-device
 * transcription. Unsupported in some browsers (notably Firefox desktop) — the
 * `supported` flag lets the UI degrade gracefully.
 */
export function useSpeechRecognition(lang = 'en-US'): UseSpeechRecognition {
  const Ctor = getRecognitionCtor();
  const [supported] = useState(() => Boolean(Ctor));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    finalRef.current = '';
    setTranscript('');
    setInterim('');
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalRef.current += (finalRef.current ? ' ' : '') + chunk;
          setTranscript(finalRef.current.trim());
        } else {
          interimText += chunk;
        }
      }
      setInterim(interimText);
    };

    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [Ctor, lang]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
    };
  }, []);

  return { supported, listening, transcript, interim, start, stop, reset };
}
