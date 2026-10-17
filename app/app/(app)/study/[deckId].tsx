import { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import type { Card as CardModel } from '@/src/types';
import type { Rating } from '@/src/fsrs/scheduler';
import { useAppStore } from '@/src/store/app';
import {
  Screen,
  Button,
  Loading,
  RatingBar,
  EmptyState,
  ensureRepo,
  nowMs,
} from '@/src/components';
import { colors, radius, spacing, fontSize } from '@/src/theme';

export default function StudyScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const id = String(deckId);
  const router = useRouter();

  const [queue, setQueue] = useState<CardModel[]>([]);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const fade = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    const repo = await ensureRepo();
    const due = await repo.getDueCards(id, nowMs());
    setQueue(due);
    setTotal(due.length);
    setIndex(0);
    setFlipped(false);
    setReady(true);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function flip() {
    Animated.timing(fade, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      setFlipped((f) => !f);
      Animated.timing(fade, { toValue: 1, duration: 110, useNativeDriver: true }).start();
    });
  }

  const current = queue[index];

  async function rate(rating: Rating) {
    if (!current || busy) return;
    setBusy(true);
    try {
      await useAppStore.getState().reviewCard(current.id, rating);
      setFlipped(false);
      setIndex((i) => i + 1);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <Screen>
        <Loading label="Подбираем карточки…" />
      </Screen>
    );
  }

  const done = !current;

  if (done) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Готово' }} />
        <EmptyState
          icon="🎉"
          title={total > 0 ? 'Сессия завершена!' : 'Нет карточек к повтору'}
          message={
            total > 0
              ? `Повторено карточек: ${total}. Возвращайтесь позже за новыми.`
              : 'Все карточки этой колоды уже изучены на сегодня.'
          }
          actionLabel="К колоде"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `Учить · ${index + 1}/${total}` }} />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(index / total) * 100}%` }]} />
      </View>

      <Pressable style={styles.cardArea} onPress={flip}>
        <Animated.View style={[styles.flashcard, { opacity: fade }]}>
          <Text style={styles.side}>{flipped ? 'Ответ' : 'Вопрос'}</Text>
          <Text style={styles.face}>{flipped ? current.back : current.front}</Text>
          {!flipped ? <Text style={styles.tapHint}>Нажмите, чтобы показать ответ</Text> : null}
        </Animated.View>
      </Pressable>

      <View style={styles.controls}>
        {flipped ? (
          <RatingBar onRate={rate} disabled={busy} />
        ) : (
          <Button title="Показать ответ" onPress={flip} full />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: { height: 6, backgroundColor: colors.accent },
  cardArea: { flex: 1, justifyContent: 'center' },
  flashcard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  side: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  face: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700', textAlign: 'center' },
  tapHint: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.md },
  controls: { paddingVertical: spacing.md },
});
