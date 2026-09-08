/**
 * Runtime configuration for SpeechPal (FluentPath mobile client).
 *
 * Reads `BACKEND_URL` from app config / env. Falls back to localhost:4000
 * for local development. Set this to your deployed backend URL in production.
 */
import Constants from 'expo-constants';

export const BACKEND_URL =
  (Constants?.expoConfig?.extra?.BACKEND_URL as string | undefined) ??
  process.env.BACKEND_URL ??
  'http://localhost:4000';

// App metadata
export const APP_NAME = 'SpeechPal';
export const APP_VERSION = Constants?.expoConfig?.version ?? '1.0.0';

// Feature flags
export const SYNC_ENABLED = true;
