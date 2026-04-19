import { useState } from 'react';
import './App.css';
import { useSessions, type Tab } from './hooks/useSessions';
import Dashboard from './components/Dashboard';
import BreathingExercise from './components/BreathingExercise';
import SpeechExercises from './components/SpeechExercises';
import VoiceRecorder from './components/VoiceRecorder';
import ProgressTracker from './components/ProgressTracker';
import TipsPanel from './components/TipsPanel';

interface NavItem {
  id: Tab;
  icon: string;
  label: string;
}

const NAV: NavItem[] = [
  { id: 'home', icon: '🏠', label: 'Home' },
  { id: 'breathing', icon: '🌬️', label: 'Breathing' },
  { id: 'exercises', icon: '🗣️', label: 'Exercises' },
  { id: 'recorder', icon: '🎙️', label: 'Record' },
  { id: 'progress', icon: '📊', label: 'Progress' },
  { id: 'tips', icon: '💡', label: 'Tips' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const { sessions, addSession, clearSessions } = useSessions();

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <span className="app-logo" aria-hidden>🗣️</span>
            <span className="app-name">FluentPath</span>
          </div>
          <nav className="nav-tabs" aria-label="Main navigation">
            {NAV.map(item => (
              <button
                key={item.id}
                className={`nav-tab${activeTab === item.id ? ' active' : ''}`}
                onClick={() => setActiveTab(item.id)}
                aria-current={activeTab === item.id ? 'page' : undefined}
              >
                <span aria-hidden>{item.icon}</span>
                <span className="tab-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'home' && (
          <Dashboard sessions={sessions} onNavigate={setActiveTab} />
        )}
        {activeTab === 'breathing' && (
          <BreathingExercise onSessionComplete={addSession} />
        )}
        {activeTab === 'exercises' && (
          <SpeechExercises onSessionComplete={addSession} />
        )}
        {activeTab === 'recorder' && (
          <VoiceRecorder onSessionComplete={addSession} />
        )}
        {activeTab === 'progress' && (
          <ProgressTracker sessions={sessions} onClear={clearSessions} />
        )}
        {activeTab === 'tips' && (
          <TipsPanel onSessionComplete={addSession} />
        )}
      </main>

      <footer className="app-footer">
        FluentPath — Speech Therapy App for People Who Stutter &nbsp;·&nbsp;
        <span style={{ fontSize: '0.8em' }}>Always work with a qualified speech-language pathologist for clinical guidance.</span>
      </footer>
    </>
  );
}
