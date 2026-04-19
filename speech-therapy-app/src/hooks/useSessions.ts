import { useState, useCallback } from 'react';

export type Tab = 'home' | 'breathing' | 'exercises' | 'recorder' | 'progress' | 'tips';

const STORAGE_KEY = 'stt_sessions';

export interface Session {
  id: string;
  type: Tab;
  label: string;
  icon: string;
  date: string;
  durationSec: number;
}

function load(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

function save(sessions: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>(load);

  const addSession = useCallback((s: Omit<Session, 'id' | 'date'>) => {
    setSessions(prev => {
      const next: Session[] = [
        { ...s, id: crypto.randomUUID(), date: new Date().toISOString() },
        ...prev,
      ].slice(0, 100);
      save(next);
      return next;
    });
  }, []);

  const clearSessions = useCallback(() => {
    setSessions([]);
    save([]);
  }, []);

  return { sessions, addSession, clearSessions };
}
