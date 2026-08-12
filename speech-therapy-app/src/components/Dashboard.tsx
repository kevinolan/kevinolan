import type { Session, Tab } from '../hooks/useSessions';
import { formatDate } from '../utils/helpers';
import { summarize } from '../utils/stats';
import StatsGrid from './StatsGrid';

interface Props {
  sessions: Session[];
  onNavigate: (tab: Tab) => void;
}

export default function Dashboard({ sessions, onNavigate }: Props) {
  const stats = summarize(sessions);

  return (
    <div>
      <div className="dashboard-welcome">
        <h2>Welcome back! 👋</h2>
        <p>Keep going — every practice session builds your confidence and fluency.</p>
        <span className="dashboard-wave" aria-hidden>🗣️</span>
      </div>

      <StatsGrid stats={stats} />

      <h3 className="section-heading">🚀 Quick Start</h3>
      <div className="quick-actions">
        <button className="quick-action-btn" onClick={() => onNavigate('breathing')}>
          <span className="quick-action-icon">🌬️</span>
          <span className="quick-action-label">Breathing Exercise</span>
          <span className="quick-action-sub">Calm nerves, steady breath</span>
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('exercises')}>
          <span className="quick-action-icon">🗣️</span>
          <span className="quick-action-label">Speech Practice</span>
          <span className="quick-action-sub">Fluency techniques</span>
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('recorder')}>
          <span className="quick-action-icon">🎙️</span>
          <span className="quick-action-label">Record & Listen</span>
          <span className="quick-action-sub">Hear your progress</span>
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('tips')}>
          <span className="quick-action-icon">💡</span>
          <span className="quick-action-label">Tips & Support</span>
          <span className="quick-action-sub">Techniques & motivation</span>
        </button>
      </div>

      {sessions.length > 0 && (
        <>
          <h3 className="section-heading" style={{ marginTop: '1.5rem' }}>🕐 Recent Activity</h3>
          <div className="session-log">
            {sessions.slice(0, 4).map(s => (
              <div className="session-entry" key={s.id}>
                <span className="session-icon">{s.icon}</span>
                <div className="session-info">
                  <div className="session-title">{s.label}</div>
                  <div className="session-meta">
                    {formatDate(s.date)} · {s.durationSec}s
                  </div>
                </div>
                <span className="badge badge-primary">{s.type}</span>
              </div>
            ))}
          </div>
        </>
      )} 
    </div>
  );
}
