import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import type { Deck, Card as CardModel } from '@/src/types';
import { useAppStore } from '@/src/store/app';
import {
  Screen,
  Card,
  Button,
  Loading,
  EmptyState,
  CardEditModal,
  PromptModal,
  ensureRepo,
  nowMs,
} from '@/src/components';
import { colors, radius, spacing, fontSize } from '@/src/theme';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = String(id);
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | undefined>();
  const [cards, setCards] = useState<CardModel[]>([]);
  const [due, setDue] = useState(0);
  const [ready, setReady] = useState(false);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CardModel | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    const repo = await ensureRepo();
    const [d, cs, dueCount] = await Promise.all([
      repo.getDeck(deckId),
      repo.getCards(deckId),
      repo.countDue(deckId, nowMs()),
    ]);
    setDeck(d);
    setCards(cs.filter((c) => c.deleted === 0));
    setDue(dueCount);
    setReady(true);
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function addCard(front: string, back: string) {
    setAdding(false);
    await useAppStore.getState().addCards(deckId, [{ front, back }]);
    await load();
  }

  async function saveEdit(front: string, back: string) {
    if (!editing) return;
    await useAppStore.getState().updateCard(editing.id, { front, back });
    setEditing(null);
    await load();
  }

  function confirmDeleteCard(card: CardModel) {
    Alert.alert('Удалить карточку?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await useAppStore.getState().deleteCard(card.id);
          await load();
        },
      },
    ]);
  }

  async function renameDeck(title: string) {
    setRenaming(false);
    await useAppStore.getState().renameDeck(deckId, title);
    await load();
  }

  function confirmDeleteDeck() {
    setMenuOpen(false);
    Alert.alert('Удалить колоду?', 'Колода и её карточки будут удалены.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await useAppStore.getState().deleteDeck(deckId);
          router.back();
        },
      },
    ]);
  }

  if (!ready) {
    return (
      <Screen>
        <Loading label="Загрузка колоды…" />
      </Screen>
    );
  }

  if (!deck) {
    return (
      <Screen>
        <EmptyState
          icon="🔍"
          title="Колода не найдена"
          actionLabel="Назад"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{
          title: deck.title,
          headerRight: () => (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>⋯</Text>
            </Pressable>
          ),
        }}
      />

      <FlatList
        data={cards}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.list, cards.length === 0 && styles.listEmpty]}
        ListHeaderComponent={
          <View style={styles.actions}>
            <Button
              title={due > 0 ? `Учить · ${due}` : 'Нет карточек к повтору'}
              onPress={() => router.push(`/study/${deckId}`)}
              disabled={due === 0}
              full
            />
            <View style={styles.row}>
              <Button
                title="Тест"
                variant="secondary"
                onPress={() => router.push(`/quiz/${deckId}`)}
                disabled={cards.length === 0}
                style={styles.flex}
              />
              <Button
                title="Импорт PDF"
                variant="secondary"
                onPress={() => router.push(`/import?deckId=${deckId}`)}
                style={styles.flex}
              />
            </View>
            <Button
              title="＋ Добавить карточку"
              variant="ghost"
              onPress={() => setAdding(true)}
              full
            />
            <Text style={styles.count}>
              {cards.length} {pluralCards(cards.length)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="🃏"
            title="В колоде пока нет карточек"
            message="Добавьте карточку вручную или импортируйте PDF."
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.cardRow}>
            <View style={styles.cardText}>
              <Text style={styles.front} numberOfLines={2}>
                {item.front}
              </Text>
              <Text style={styles.back} numberOfLines={2}>
                {item.back}
              </Text>
            </View>
            <View style={styles.cardBtns}>
              <Pressable onPress={() => setEditing(item)} hitSlop={8} style={styles.iconBtn}>
                <Text style={styles.iconEdit}>✎</Text>
              </Pressable>
              <Pressable onPress={() => confirmDeleteCard(item)} hitSlop={8} style={styles.iconBtn}>
                <Text style={styles.iconDelete}>🗑</Text>
              </Pressable>
            </View>
          </Card>
        )}
      />

      <CardEditModal
        visible={adding}
        title="Новая карточка"
        confirmLabel="Добавить"
        onCancel={() => setAdding(false)}
        onConfirm={addCard}
      />
      <CardEditModal
        visible={!!editing}
        title="Изменить карточку"
        initialFront={editing?.front}
        initialBack={editing?.back}
        onCancel={() => setEditing(null)}
        onConfirm={saveEdit}
      />
      <PromptModal
        visible={renaming}
        title="Переименовать колоду"
        label="Название"
        initialValue={deck.title}
        onCancel={() => setRenaming(false)}
        onConfirm={renameDeck}
      />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
            >
              <Text style={styles.menuText}>Переименовать</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={confirmDeleteDeck}>
              <Text style={[styles.menuText, styles.menuDanger]}>Удалить колоду</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function pluralCards(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'карточка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'карточки';
  return 'карточек';
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxl },
  listEmpty: { flexGrow: 1 },
  actions: { gap: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  count: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.xs },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardText: { flex: 1, gap: 2 },
  front: { color: colors.text, fontSize: fontSize.md, fontWeight: '600' },
  back: { color: colors.textMuted, fontSize: fontSize.sm },
  cardBtns: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.sm },
  iconEdit: { color: colors.accent, fontSize: fontSize.lg },
  iconDelete: { fontSize: fontSize.lg },
  headerBtn: { paddingHorizontal: spacing.sm },
  headerBtnText: { color: colors.text, fontSize: fontSize.xl, fontWeight: '700' },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  menu: {
    position: 'absolute',
    top: 56,
    right: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 200,
    overflow: 'hidden',
  },
  menuItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  menuText: { color: colors.text, fontSize: fontSize.md },
  menuDanger: { color: colors.danger },
  menuDivider: { height: 1, backgroundColor: colors.border },
});
