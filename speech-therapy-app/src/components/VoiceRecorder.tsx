import { useState, useRef, useEffect } from 'react';
import { useRenderPerf } from '../utils/perf';
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
  useRenderPerf('VoiceRecorder');
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [supported] = useState(() => !!navigator.mediaDevices?.getUserMedia);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
      // Release the microphone if the component unmounts mid-recording
      if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio visualiser
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      function drawBars() {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            const barW = w / BAR_COUNT;
            const step = Math.floor(data.length / BAR_COUNT) || 1;
            for (let i = 0; i < BAR_COUNT; i++) {
              const val = data[i * step] ?? 0;
              const barH = Math.max(4, (val / 255) * (h - 4));
              const x = i * barW;
              const y = h - barH;
              ctx.fillStyle = isRecording ? 'rgba(79,142,247,1)' : 'rgba(79,142,247,0.35)';
              ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
            }
          }
        }
        animFrameRef.current = requestAnimationFrame(drawBars);
      }
      drawBars();

      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stopAnimation();
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
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
            <canvas
              ref={canvasRef}
              className="recorder-visualizer"
              aria-hidden
              width={800}
              height={120}
              style={{ width: '100%', height: '60px' }}
            />

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
