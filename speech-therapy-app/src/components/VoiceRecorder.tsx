import { useState, useRef, useEffect } from 'react';
import type { Session } from '../hooks/useSessions';

interface RecordingEntry {
  id: string;
  url: string;
  label: string;
  date: string;
}

interface Props {
  onSessionComplete: (s: Omit<Session, 'id' | 'date'>) => void;
}

const BAR_COUNT = 40;

export default function VoiceRecorder({ onSessionComplete }: Props) {
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [supported] = useState(() => !!navigator.mediaDevices?.getUserMedia);
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(4));

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  function stopAnimation() {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      stopAnimation();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Set up audio visualiser
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      function drawBars() {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const step = Math.floor(data.length / BAR_COUNT);
        const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const val = data[i * step] ?? 0;
          return Math.max(4, (val / 255) * 72);
        });
        setBars(newBars);
        animFrameRef.current = requestAnimationFrame(drawBars);
      }
      drawBars();

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stopAnimation();
        setBars(Array(BAR_COUNT).fill(4));
        stream.getTracks().forEach(t => t.stop());
        ctx.close();

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const entry: RecordingEntry = {
          id: crypto.randomUUID(),
          url,
          label: `Recording ${new Date().toLocaleTimeString()}`,
          date: new Date().toISOString(),
        };
        setRecordings(prev => [entry, ...prev]);

        const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
        onSessionComplete({
          type: 'recorder',
          label: 'Voice Recording',
          icon: '🎙️',
          durationSec: dur,
        });
      };

      mr.start();
      mediaRef.current = mr;
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setElapsed(0);

      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access in your browser settings.');
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    setIsRecording(false);
    setElapsed(0);
  }

  function deleteRecording(id: string) {
    setRecordings(prev => {
      const entry = prev.find(r => r.id === id);
      if (entry) URL.revokeObjectURL(entry.url);
      return prev.filter(r => r.id !== id);
    });
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <div>
      <h2 className="section-heading">🎙️ Voice Recorder</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        Record yourself reading aloud or practising exercises. Listening back helps you notice patterns and track improvement over time.
      </p>

      <div className="card">
        <div className="card-title">Record your voice</div>

        {!supported ? (
          <div style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>
            ⚠️ Your browser does not support audio recording. Please use a modern browser like Chrome or Firefox.
          </div>
        ) : (
          <div className="recorder-section">
            <div className="recorder-visualizer" aria-hidden>
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="viz-bar"
                  style={{
                    height: `${h}px`,
                    opacity: isRecording ? 1 : 0.35,
                  }}
                />
              ))}
            </div>

            {isRecording && (
              <div className="recorder-status">
                <span className="rec-dot" />
                Recording — {formatTime(elapsed)}
              </div>
            )}

            <button
              className={`recorder-btn btn-primary${isRecording ? ' recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? '⏹' : '🎙️'}
            </button>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {isRecording ? 'Press the button to stop' : 'Press the button to start recording'}
            </p>
          </div>
        )}
      </div>

      {recordings.length > 0 && (
        <div className="card">
          <div className="card-title">🎧 Your Recordings</div>
          <div className="recordings-list">
            {recordings.map(r => (
              <div className="recording-entry" key={r.id}>
                <span className="recording-label">{r.label}</span>
                <audio controls src={r.url} />
                <button
                  className="recording-delete"
                  onClick={() => deleteRecording(r.id)}
                  aria-label="Delete recording"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">📋 What to record</div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <li>Read a short paragraph aloud at a comfortable pace</li>
          <li>Introduce yourself — name, where you're from, one hobby</li>
          <li>Describe your day or something you did recently</li>
          <li>Practice a specific speech technique (e.g., easy onset)</li>
          <li>Repeat the same recording weekly to hear your progress</li>
        </ul>
      </div>
    </div>
  );
}
