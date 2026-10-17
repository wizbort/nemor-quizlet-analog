import { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import type { QuizQuestion } from '@/src/types';
import { generateQuiz, gradeAnswer, type GeneratedCard } from '@/src/api/client';
import { useAuthStore } from '@/src/store/auth';
import {
  Screen,
  Card,
  Button,
  Loading,
  TextField,
  EmptyState,
  ensureRepo,
} from '@/src/components';
import { colors, radius, spacing, fontSize } from '@/src/theme';

type Phase = 'loading' | 'empty' | 'quiz' | 'done' | 'error';

export default function QuizScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const id = String(deckId);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // per-question answer state
  const [picked, setPicked] = useState<number | null>(null);
  const [shortText, setShortText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  const session = () => useAuthStore.getState().session ?? '';

  const build = useCallback(async () => {
    setPhase('loading');
    try {
      const repo = await ensureRepo();
      const cards = (await repo.getCards(id)).filter((c) => c.deleted === 0);
      if (cards.length === 0) {
        setPhase('empty');
        return;
      }
      const payload: GeneratedCard[] = cards.map((c) => ({ front: c.front, back: c.back }));
      const out = await generateQuiz({ deckId: id, cards: payload }, session());
      if (!out.questions.length) {
        setPhase('empty');
        return;
      }
      setQuestions(out.questions);
      resetQuestion();
      setIndex(0);
      setScore(0);
      setPhase('quiz');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Не удалось создать тест');
      setPhase('error');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void build();
    }, [build]),
  );

  function resetQuestion() {
    setPicked(null);
    setShortText('');
    setRevealed(false);
    setFeedback('');
    setLastCorrect(false);
  }

  const q = questions[index];

  function submitMcq(choice: number) {
    if (revealed || !q) return;
    setPicked(choice);
    const correct = choice === q.answerIndex;
    setLastCorrect(correct);
    setRevealed(true);
    if (correct) setScore((s) => s + 1);
  }

  async function submitShort() {
    if (revealed || !q || !shortText.trim() || grading) return;
    setGrading(true);
    try {
      const res = await gradeAnswer({ question: q, userAnswer: shortText.trim() }, session());
      setLastCorrect(res.correct);
      setFeedback(res.feedback);
      setRevealed(true);
      if (res.correct) setScore((s) => s + 1);
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Ошибка проверки');
      setRevealed(true);
    } finally {
      setGrading(false);
    }
  }

  function next() {
    if (index + 1 >= questions.length) {
      setPhase('done');
      return;
    }
    setIndex((i) => i + 1);
    resetQuestion();
  }

  if (phase === 'loading') {
    return (
      <Screen>
        <Loading label="Готовим тест…" />
      </Screen>
    );
  }
  if (phase === 'empty') {
    return (
      <Screen>
        <EmptyState
          icon="📝"
          title="Недостаточно карточек"
          message="Добавьте карточки в колоду, чтобы пройти тест."
          actionLabel="Назад"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }
  if (phase === 'error') {
    return (
      <Screen>
        <EmptyState
          icon="⚠️"
          title="Не удалось создать тест"
          message={errorMsg}
          actionLabel="Повторить"
          onAction={build}
        />
      </Screen>
    );
  }
  if (phase === 'done') {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Результат' }} />
        <EmptyState
          icon={pct >= 70 ? '🏆' : '📊'}
          title={`${score} из ${questions.length} · ${pct}%`}
          message={pct >= 70 ? 'Отличный результат!' : 'Хорошая попытка — повторите сложные темы.'}
          actionLabel="К колоде"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: `Тест · ${index + 1}/${questions.length}` }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(index / questions.length) * 100}%` }]} />
        </View>

        <Text style={styles.prompt}>{q.prompt}</Text>

        {q.type === 'mcq' ? (
          <View style={styles.options}>
            {(q.options ?? []).map((opt, i) => {
              const isAnswer = i === q.answerIndex;
              const isPicked = i === picked;
              let optStyle = styles.option;
              if (revealed && isAnswer) optStyle = styles.optionCorrect;
              else if (revealed && isPicked && !isAnswer) optStyle = styles.optionWrong;
              return (
                <Pressable
                  key={i}
                  onPress={() => submitMcq(i)}
                  disabled={revealed}
                  style={({ pressed }) => [optStyle, pressed && !revealed && styles.optionPressed]}
                >
                  <Text style={styles.optionText}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.shortWrap}>
            <TextField
              value={shortText}
              onChangeText={setShortText}
              placeholder="Ваш ответ"
              multiline
              editable={!revealed}
            />
            {!revealed ? (
              <Button
                title="Проверить"
                onPress={submitShort}
                loading={grading}
                disabled={!shortText.trim()}
                full
              />
            ) : null}
          </View>
        )}

        {revealed ? (
          <Card variant="alt" style={styles.feedbackBox}>
            <Text style={[styles.verdict, lastCorrect ? styles.ok : styles.bad]}>
              {lastCorrect ? '✓ Верно' : '✗ Неверно'}
            </Text>
            {q.type === 'short' && q.answer ? (
              <Text style={styles.correctAnswer}>Ответ: {q.answer}</Text>
            ) : null}
            {feedback || q.explanation ? (
              <Text style={styles.explanation}>{feedback || q.explanation}</Text>
            ) : null}
          </Card>
        ) : null}

        {revealed ? (
          <Button
            title={index + 1 >= questions.length ? 'Показать результат' : 'Дальше'}
            onPress={next}
            full
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.accent },
  prompt: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700', lineHeight: 26 },
  options: { gap: spacing.sm },
  option: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  optionPressed: { opacity: 0.8 },
  optionCorrect: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  optionWrong: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  optionText: { color: colors.text, fontSize: fontSize.md },
  shortWrap: { gap: spacing.md },
  feedbackBox: { gap: spacing.sm },
  verdict: { fontSize: fontSize.md, fontWeight: '800' },
  ok: { color: colors.success },
  bad: { color: colors.danger },
  correctAnswer: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  explanation: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 },
});
