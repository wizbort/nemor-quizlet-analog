import type { Env } from '../types';

// OpenRouter-compatible LLM transport.
// POST to OPENROUTER_PROXY_URL + '/v1/chat/completions' with
// Authorization: Bearer OPENROUTER_PROXY_KEY. Iterate LLM_MODELS in order;
// on non-200 or empty choices, fall through to the next model.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  models?: string[];
}

/** Resolve the ordered model list (override via opts, else env.LLM_MODELS). */
function resolveModels(env: Env, opts?: ChatOptions): string[] {
  if (opts?.models?.length) return opts.models;
  return (env.LLM_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * Run a raw chat completion, returning the assistant text. Tries each model in
 * order; on a non-200 response or empty/blank choices, advances to the next.
 * Throws once all candidate models are exhausted.
 */
export async function chatCompletion(
  env: Env,
  messages: ChatMessage[],
  opts?: ChatOptions,
): Promise<string> {
  const url = env.OPENROUTER_PROXY_URL.replace(/\/+$/, '') + '/v1/chat/completions';
  const models = resolveModels(env, opts);
  if (models.length === 0) throw new Error('no LLM models configured');

  const temperature = opts?.temperature ?? 0.3;
  const maxTokens = opts?.maxTokens ?? 1200;

  let lastError: string = 'all models failed';
  for (const model of models) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + env.OPENROUTER_PROXY_KEY,
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
      });

      if (!res.ok) {
        lastError = `model ${model} returned HTTP ${res.status}`;
        continue; // try next model
      }

      const data: any = await res.json().catch(() => null);
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string' && content.trim().length > 0) {
        return content;
      }
      lastError = `model ${model} returned empty choices`;
    } catch (err) {
      // Network / parse error — record and try the next model.
      lastError = `model ${model} error: ${(err as Error)?.message ?? String(err)}`;
    }
  }
  throw new Error('LLM completion failed: ' + lastError);
}

/**
 * Strip Markdown code fences (```json ... ``` or ``` ... ```) from raw text.
 */
function stripCodeFences(raw: string): string {
  let s = raw.trim();
  // Leading ```lang
  s = s.replace(/^```[a-zA-Z0-9]*\s*\n?/, '');
  // Trailing ```
  s = s.replace(/\n?```\s*$/, '');
  return s.trim();
}

/**
 * Extract the first balanced {...} or [...] substring from text. Respects string
 * literals and escapes so braces inside strings don't break balancing.
 */
function extractBalanced(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse model output as JSON tolerantly: fences -> direct -> balanced block. */
function parseTolerant<T>(raw: string): T {
  const cleaned = stripCodeFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through to balanced-substring extraction.
  }
  const block = extractBalanced(cleaned) ?? extractBalanced(raw);
  if (block) {
    try {
      return JSON.parse(block) as T;
    } catch {
      // fall through to error
    }
  }
  throw new Error('LLM did not return parseable JSON: ' + raw.slice(0, 300));
}

/**
 * Run a chat completion that is expected to emit JSON and parse it as T.
 * Instructs the model to return JSON only and parses tolerantly.
 */
export async function chatJSON<T>(
  env: Env,
  opts: { system: string; user: string; maxTokens?: number },
): Promise<T> {
  const system =
    opts.system +
    '\n\nRespond with valid JSON only. Do not include explanations, prose, or Markdown code fences.';
  const text = await chatCompletion(
    env,
    [
      { role: 'system', content: system },
      { role: 'user', content: opts.user },
    ],
    { temperature: 0.3, maxTokens: opts.maxTokens ?? 1200 },
  );
  return parseTolerant<T>(text);
}
