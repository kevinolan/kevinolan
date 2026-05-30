import { describe, test, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessions } from '../hooks/useSessions';

describe('useSessions', () => {
  test('addSession adds a session and persists to localStorage', () => {
    // Setup a fake localStorage
    const store: Record<string, string> = {};
    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };

    const { result } = renderHook(() => useSessions());
    act(() => {
      result.current.addSession({ type: 'tips', label: 't', icon: 'i', durationSec: 5 });
    });

    expect(result.current.sessions.length).toBeGreaterThanOrEqual(1);
    expect(store['stt_sessions']).toBeDefined();
  });
});
