import type { Session, Tab } from '../hooks/useSessions';
import { calcStreak, formatDate } from '../utils/helpers';

interface Props {
  sessions: Session[];
  onNavigate: (tab: Tab) => void;
}

export default function Dashboard({ sessions, onNavigate }: Props) {
  const totalSessions = sessions.length;
  const totalMinutes = Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / 60);
  const streak = calcStreak(sessions);

  return (
    <div>
      <div className="dashboard-welcome">
        <h2>Welcome back! 👋</h2>
        <p>Keep going — every practice session builds your confidence and fluency.</p>
        <span className="dashboard-wave" aria-hidden>🗣️</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card-icon">📅</span>
          <span className="stat-card-value">{totalSessions}</span>
          <span className="stat-card-label">Total Sessions</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-icon">⏱️</span>
          <span className="stat-card-value">{totalMinutes}</span>
          <span className="stat-card-label">Minutes Practiced</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-icon">🔥</span>
          <span className="stat-card-value">{streak}</span>
          <span className="stat-card-label">Day Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-icon">🏆</span>
          <span className="stat-card-value">{calcBadges(totalSessions)}</span>
          <span className="stat-card-label">Badges Earned</span>
        </div>
      </div>

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

function calcBadges(sessions: number): number {
  return Math.floor(sessions / 3);
}
