import { create } from 'zustand';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '../types';
import * as api from '../api/client';
import type { LoginResponse } from '../api/client';

// Auth store. Persists the session token in expo-secure-store on native and
// localStorage on web. On hydrate it validates the token via /auth/session.
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

const SESSION_KEY = 'nemor.session';

// --- Platform token storage ---------------------------------------------------
async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(SESSION_KEY, token);
    } catch {
      /* storage may be unavailable (private mode) */
    }
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(SESSION_KEY) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(SESSION_KEY);
}

async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export interface AuthState {
  user: AuthUser | null;
  session: string | null;
  status: AuthStatus;
  /** Restore persisted session from secure storage and validate it. */
  hydrate(): Promise<void>;
  /** Request a Telegram OTP for the given phone. */
  login(phone: string): Promise<LoginResponse>;
  /** Verify the OTP code; on success sets user/session and status='signedIn'. */
  verify(phone: string, code: string): Promise<void>;
  /** Clear session locally and remotely. */
  logout(): Promise<void>;
}

// Lazily import the sync trigger to avoid a static import cycle
// (app store -> auth store -> app store).
async function triggerInitialSync(): Promise<void> {
  try {
    const mod = await import('./app');
    await mod.useAppStore.getState().sync();
  } catch {
    /* sync is best-effort; failures must not block sign-in */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  status: 'loading',

  async hydrate() {
    const token = await loadToken();
    if (!token) {
      set({ user: null, session: null, status: 'signedOut' });
      return;
    }
    try {
      const res = await api.getSession(token);
      if (res.success && res.user) {
        set({ user: res.user, session: token, status: 'signedIn' });
        void triggerInitialSync();
      } else {
        await clearToken();
        set({ user: null, session: null, status: 'signedOut' });
      }
    } catch {
      // Invalid/expired token (or offline). Drop to signedOut so the UI can
      // route to login; a fresh sign-in re-establishes the session.
      await clearToken();
      set({ user: null, session: null, status: 'signedOut' });
    }
  },

  async login(phone: string) {
    return api.login(phone);
  },

  async verify(phone: string, code: string) {
    const res = await api.verify(phone, code);
    await saveToken(res.session);
    set({ user: res.user, session: res.session, status: 'signedIn' });
    void triggerInitialSync();
  },

  async logout() {
    const token = get().session;
    if (token) {
      try {
        await api.logout(token);
      } catch {
        /* best-effort remote logout; clear locally regardless */
      }
    }
    await clearToken();
    set({ user: null, session: null, status: 'signedOut' });
  },
}));
