import { Hono } from 'hono';
import type { Env, QuizQuestion } from '../types';
import { requireUser } from '../lib/authClient';
import { chatJSON, chatCompletion } from '../lib/llm';

// AI router (Bearer). PDF->Markdown + LLM card/quiz generation & grading.
//   POST /api/recognize        -> { markdown }  (multipart "file" or raw + ?name)
//   POST /api/cards/generate   -> { cards: [{ front, back }] }
//   POST /api/quiz             -> { questions: QuizQuestion[] }
//   POST /api/quiz/grade       -> { correct, feedback }
export const aiRouter = new Hono<{ Bindings: Env }>();

/** Clamp n into [min, max], using `fallback` when n is not a finite number. */
function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

// POST /recognize — PDF -> Markdown via Workers AI toMarkdown().
// Accepts multipart/form-data with a `file` field, OR raw bytes with ?name=.
aiRouter.post('/recognize', async (c) => {
  await requireUser(c);

  const contentType = c.req.header('Content-Type') || '';
  let name = c.req.query('name') || 'document.pdf';
  let blob: Blob;

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData();
    const file = form.get('file');
    // A file field is a Blob with a `name`; a plain text field is a string.
    if (!file || typeof file === 'string') {
      return c.json(
        { error: { code: 'bad_request', message: 'multipart field "file" is required' } },
        400,
      );
    }
    const fname = (file as unknown as { name?: string }).name;
    if (fname) name = fname;
    blob = file as unknown as Blob;
  } else {
    // Raw bytes in the request body; filename comes from ?name.
    const buf = await c.req.arrayBuffer();
    if (!buf || buf.byteLength === 0) {
      return c.json(
        { error: { code: 'bad_request', message: 'empty request body' } },
        400,
      );
    }
    blob = new Blob([buf]);
  }

  const result: any = await c.env.AI.toMarkdown([{ name, blob }]);
  const markdown = result?.[0]?.data ?? '';
  return c.json({ markdown });
});

// POST /cards/generate — generate flashcards from text via the LLM.
// Body { text, count?, deckTitle? }. count clamped 1..50 (default 12).
aiRouter.post('/cards/generate', async (c) => {
  await requireUser(c);

  const body = await c
    .req.json<{ text?: string; count?: number; deckTitle?: string }>()
    .catch(() => ({} as any));
  const text = (body.text ?? '').toString();
  if (!text.trim()) {
    return c.json({ error: { code: 'bad_request', message: 'text is required' } }, 400);
  }
  const count = clamp(body.count, 1, 50, 12);
  const deckTitle = (body.deckTitle ?? '').toString().trim();

  const system =
    'You are a study assistant that creates concise flashcards from study material. ' +
    'Each card has a short "front" (a question or term) and a "back" (the answer or ' +
    'definition). Cover the most important, testable facts. Avoid duplicates. ' +
    'Return JSON of the exact shape {"cards":[{"front":"...","back":"..."}]}.';
  const user =
    `Create exactly ${count} flashcards` +
    (deckTitle ? ` for a deck titled "${deckTitle}"` : '') +
    ` from the following material:\n\n${text}`;

  const data = await chatJSON<{ cards?: Array<{ front?: unknown; back?: unknown }> }>(
    c.env,
    { system, user, maxTokens: 2000 },
  );

  // Normalize and bound the output.
  const cards = (Array.isArray(data?.cards) ? data.cards : [])
    .map((k: { front?: unknown; back?: unknown }) => ({
      front: String(k?.front ?? '').trim(),
      back: String(k?.back ?? '').trim(),
    }))
    .filter((k: { front: string; back: string }) => k.front && k.back)
    .slice(0, count);

  return c.json({ cards });
});

// POST /quiz — generate a quiz from a deck's cards via the LLM.
// Body { deckId?, cards?: [{front,back}], count?, types? }.
// The client passes `cards`; deckId is accepted but the server does not fetch.
aiRouter.post('/quiz', async (c) => {
  await requireUser(c);

  const body = await c
    .req.json<{
      deckId?: string;
      cards?: Array<{ front?: string; back?: string }>;
      count?: number;
      types?: string[];
    }>()
    .catch(() => ({} as any));

  const cards = Array.isArray(body.cards)
    ? body.cards
        .map((k: { front?: unknown; back?: unknown }) => ({
          front: String(k?.front ?? '').trim(),
          back: String(k?.back ?? '').trim(),
        }))
        .filter((k: { front: string; back: string }) => k.front && k.back)
    : [];

  if (cards.length === 0) {
    return c.json(
      {
        error: {
          code: 'bad_request',
          message: 'cards are required (pass the deck cards in the request body)',
        },
      },
      400,
    );
  }

  const count = clamp(body.count, 1, 50, 8);
  const allowed = ['mcq', 'short'];
  const types =
    Array.isArray(body.types) && body.types.length
      ? body.types.filter((t: string) => allowed.includes(t))
      : ['mcq', 'short'];
  const typeList = (types.length ? types : allowed).join(', ');

  const system =
    'You are a quiz generator. From the provided flashcards, write quiz questions. ' +
    'Use a mix of the requested types. For "mcq": include "options" (3-4 strings) and ' +
    '"answerIndex" (0-based index of the correct option). For "short": include "answer" ' +
    '(the expected short answer). Always include a stable unique "id", a "prompt", a ' +
    '"type" of "mcq" or "short", and an "explanation". Return JSON of the exact shape ' +
    '{"questions":[{"id","type","prompt","options?","answerIndex?","answer?","explanation"}]}.';
  const user =
    `Create exactly ${count} questions (types: ${typeList}) from these flashcards:\n\n` +
    JSON.stringify(cards);

  const data = await chatJSON<{ questions?: any[] }>(c.env, {
    system,
    user,
    maxTokens: 2500,
  });

  // Normalize each question to the QuizQuestion shape.
  const questions: QuizQuestion[] = (Array.isArray(data?.questions) ? data.questions : [])
    .map((q: any, i: number): QuizQuestion | null => {
      const type = q?.type === 'short' ? 'short' : q?.type === 'mcq' ? 'mcq' : null;
      const prompt = String(q?.prompt ?? '').trim();
      if (!type || !prompt) return null;
      const out: QuizQuestion = {
        id: String(q?.id ?? `q${i + 1}`),
        type,
        prompt,
        explanation: q?.explanation != null ? String(q.explanation) : undefined,
      };
      if (type === 'mcq') {
        const options = Array.isArray(q?.options) ? q.options.map((o: unknown) => String(o)) : [];
        if (options.length < 2) return null;
        out.options = options;
        out.answerIndex = clamp(q?.answerIndex, 0, options.length - 1, 0);
      } else {
        out.answer = String(q?.answer ?? '').trim();
      }
      return out;
    })
    .filter((q): q is QuizQuestion => q !== null)
    .slice(0, count);

  return c.json({ questions });
});

// POST /quiz/grade — judge a free-text short answer via the LLM.
// Body { question, userAnswer } -> { correct, feedback }.
aiRouter.post('/quiz/grade', async (c) => {
  await requireUser(c);

  const body = await c
    .req.json<{ question?: any; userAnswer?: string }>()
    .catch(() => ({} as any));
  const question = body.question;
  const userAnswer = (body.userAnswer ?? '').toString();
  if (!question) {
    return c.json({ error: { code: 'bad_request', message: 'question is required' } }, 400);
  }

  const expected =
    typeof question === 'string'
      ? question
      : question?.answer ?? question?.prompt ?? JSON.stringify(question);

  const system =
    'You are a fair grader of short free-text answers. Decide whether the user answer is ' +
    'correct given the expected answer, allowing for synonyms, paraphrase, and minor ' +
    'spelling differences. Be lenient on wording but strict on meaning. Return JSON of the ' +
    'exact shape {"correct": true|false, "feedback": "one short sentence"}.';
  const user =
    `Question: ${typeof question === 'string' ? question : question?.prompt ?? ''}\n` +
    `Expected answer: ${expected}\n` +
    `User answer: ${userAnswer}`;

  // Use chatCompletion + tolerant parse here to keep grading explicit.
  const text = await chatCompletion(
    c.env,
    [
      {
        role: 'system',
        content:
          system + '\n\nRespond with valid JSON only, no prose or code fences.',
      },
      { role: 'user', content: user },
    ],
    { temperature: 0.2, maxTokens: 200 },
  );

  // Parse leniently; default to incorrect with the raw text as feedback on failure.
  let correct = false;
  let feedback = '';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    correct = parsed?.correct === true;
    feedback = String(parsed?.feedback ?? '');
  } catch {
    feedback = text.trim().slice(0, 200);
  }

  return c.json({ correct, feedback });
});
