import type {
  AuthUser,
  QuizQuestion,
  SyncPayload,
  SyncPullResult,
} from '../types';
import { API_BASE } from '../config';

// Typed client for the /api BFF. All paths are relative to API_BASE (config.ts);
// session is passed as a Bearer token. See /CONTRACT.md.

export interface LoginResponse {
  success: boolean;
  expiresAt?: number;
  telegram?: unknown;
}

export interface VerifyResponse {
  success: boolean;
  session: string;
  user: AuthUser;
}

export interface SessionResponse {
  success: boolean;
  user: AuthUser;
  expiresAt?: number;
}

export interface GeneratedCard {
  front: string;
  back: string;
}

/** Error thrown for non-2xx responses; carries status and parsed body. */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const m = b.error ?? b.message;
    if (typeof m === 'string' && m) return m;
  }
  if (typeof body === 'string' && body) return body;
  return `Request failed with status ${status}`;
}

/**
 * Low-level fetch helper. Prefixes API_BASE, sets JSON headers, and attaches
 * Authorization: Bearer <sessionToken> when provided. Throws ApiError on non-2xx.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  sessionToken?: string,
): Promise<T> {
  const headers = new Headers(init?.headers);
  // Don't override Content-Type for FormData (browser sets the boundary).
  const isForm =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (!isForm && !headers.has('Content-Type') && init?.body != null) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);

  const res = await fetch(`${API_BASE}/api${path}`, { ...init, headers });
  const body = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(res.status, body), body);
  }
  return body as T;
}

// --- Auth ---
export async function login(phone: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verify(phone: string, code: string): Promise<VerifyResponse> {
  return apiFetch<VerifyResponse>('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
}

export async function getSession(sessionToken: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>('/auth/session', { method: 'GET' }, sessionToken);
}

export async function logout(sessionToken: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(
    '/auth/logout',
    { method: 'POST' },
    sessionToken,
  );
}

// --- Sync ---
export async function pullSync(
  sinceMs: number,
  sessionToken: string,
): Promise<SyncPullResult> {
  return apiFetch<SyncPullResult>(
    `/sync?since=${encodeURIComponent(String(sinceMs))}`,
    { method: 'GET' },
    sessionToken,
  );
}

export async function pushSync(
  payload: SyncPayload,
  sessionToken: string,
): Promise<{ ok: true; now: number }> {
  return apiFetch<{ ok: true; now: number }>(
    '/sync',
    { method: 'POST', body: JSON.stringify(payload) },
    sessionToken,
  );
}

// --- AI ---
export async function recognizePdf(
  file: Blob | File,
  name: string,
  sessionToken: string,
): Promise<{ markdown: string }> {
  const form = new FormData();
  // RN FormData accepts Blob; cast keeps web File typing happy too.
  form.append('file', file as Blob, name);
  return apiFetch<{ markdown: string }>(
    '/recognize',
    { method: 'POST', body: form },
    sessionToken,
  );
}

export async function generateCards(
  input: { text: string; count?: number; deckTitle?: string },
  sessionToken: string,
): Promise<{ cards: GeneratedCard[] }> {
  return apiFetch<{ cards: GeneratedCard[] }>(
    '/cards/generate',
    { method: 'POST', body: JSON.stringify(input) },
    sessionToken,
  );
}

export async function generateQuiz(
  input: {
    deckId?: string;
    cards?: GeneratedCard[];
    count?: number;
    types?: Array<'mcq' | 'short'>;
  },
  sessionToken: string,
): Promise<{ questions: QuizQuestion[] }> {
  return apiFetch<{ questions: QuizQuestion[] }>(
    '/quiz',
    { method: 'POST', body: JSON.stringify(input) },
    sessionToken,
  );
}

export async function gradeAnswer(
  input: { question: QuizQuestion; userAnswer: string },
  sessionToken: string,
): Promise<{ correct: boolean; feedback: string }> {
  return apiFetch<{ correct: boolean; feedback: string }>(
    '/quiz/grade',
    { method: 'POST', body: JSON.stringify(input) },
    sessionToken,
  );
}
