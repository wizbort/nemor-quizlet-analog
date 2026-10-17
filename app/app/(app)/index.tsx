import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import type { Deck } from '@/src/types';
import { useAppStore } from '@/src/store/app';
import {
  Screen,
  Card,
  Loading,
  EmptyState,
  SyncBadge,
  PromptModal,
  ensureRepo,
  nowMs,
} from '@/src/components';
import { colors, radius, spacing, fontSize } from '@/src/theme';

export default function DecksScreen() {
  const router = useRouter();
  const decks = useAppStore((s) => s.decks);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);

  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dueByDeck, setDueByDeck] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);

  const loadDue = useCallback(async (list: Deck[]) => {
    const repo = await ensureRepo();
    const now = nowMs();
    const entries = await Promise.all(
      list.map(async (d) => [d.id, await repo.countDue(d.id, now)] as const),
    );
    setDueByDeck(Object.fromEntries(entries));
  }, []);

  const refreshLocal = useCallback(async () => {
    await ensureRepo();
    await useAppStore.getState().loadDecks();
    await loadDue(useAppStore.getState().decks);
  }, [loadDue]);

  useEffect(() => {
    (async () => {
      await refreshLocal();
      setReady(true);
    })();
  }, [refreshLocal]);

  // Reload whenever returning to this screen (after edits elsewhere).
  useFocusEffect(
    useCallback(() => {
      void refreshLocal();
    }, [refreshLocal]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await useAppStore.getState().sync();
      await refreshLocal();
    } finally {
      setRefreshing(false);
    }
  }, [refreshLocal]);

  async function createDeck(title: string) {
    setCreating(false);
    const deck = await useAppStore.getState().createDeck(title);
    await loadDue(useAppStore.getState().decks);
    router.push(`/deck/${deck.id}`);
  }

  if (!ready) {
    return (
      <Screen>
        <Loading label="Загрузка колод…" />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>⚙</Text>
            </Pressable>
          ),
        }}
      />
      <View style={styles.topBar}>
        <SyncBadge status={syncStatus} lastSyncedAt={lastSyncedAt} />
      </View>

      <FlatList
        data={decks}
        keyExtractor={(d) => d.id}
        contentContainerStyle={[
          styles.list,
          decks.length === 0 && styles.listEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📚"
            title="Пока нет колод"
            message="Создайте колоду кнопкой «+» или импортируйте PDF, чтобы сгенерировать карточки."
            actionLabel="Создать колоду"
            onAction={() => setCreating(true)}
          />
        }
        renderItem={({ item }) => (
          <DeckRow
            deck={item}
            due={dueByDeck[item.id] ?? 0}
            onPress={() => router.push(`/deck/${item.id}`)}
          />
        )}
      />

      <Pressable
        accessibilityLabel="Создать колоду"
        accessibilityRole="button"
        onPress={() => setCreating(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      <PromptModal
        visible={creating}
        title="Новая колода"
        label="Название"
        placeholder="Например: Английские слова"
        confirmLabel="Создать"
        onCancel={() => setCreating(false)}
        onConfirm={createDeck}
      />
    </Screen>
  );
}

function DeckRow({
  deck,
  due,
  onPress,
}: {
  deck: Deck;
  due: number;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.deckRow}>
      <View style={styles.deckInfo}>
        <Text style={styles.deckTitle} numberOfLines={1}>
          {deck.title}
        </Text>
        {deck.description ? (
          <Text style={styles.deckDesc} numberOfLines={1}>
            {deck.description}
          </Text>
        ) : null}
      </View>
      {due > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{due}</Text>
        </View>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 96 },
  listEmpty: { flexGrow: 1 },
  deckRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deckInfo: { flex: 1, gap: 2 },
  deckTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  deckDesc: { color: colors.textMuted, fontSize: fontSize.sm },
  badge: {
    minWidth: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  badgeText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '800' },
  chevron: { color: colors.textMuted, fontSize: fontSize.xl },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabPressed: { opacity: 0.85 },
  fabIcon: { color: '#fff', fontSize: 34, fontWeight: '300', lineHeight: 38 },
  headerBtn: { paddingHorizontal: spacing.sm },
  headerBtnText: { color: colors.text, fontSize: fontSize.xl },
});
