import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { recognizePdf, generateCards, type GeneratedCard } from '@/src/api/client';
import { useAuthStore } from '@/src/store/auth';
import { useAppStore } from '@/src/store/app';
import {
  Screen,
  Card,
  Button,
  Loading,
  TextField,
  PromptModal,
  uid,
} from '@/src/components';
import { colors, radius, spacing, fontSize } from '@/src/theme';

type Draft = { key: string; front: string; back: string };
type Phase = 'pick' | 'recognizing' | 'review' | 'generating' | 'drafts' | 'saving';

export default function ImportScreen() {
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>('pick');
  const [fileName, setFileName] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [askTitle, setAskTitle] = useState(false);

  function session(): string {
    return useAuthStore.getState().session ?? '';
  }

  async function pickAndRecognize() {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setFileName(asset.name ?? 'document.pdf');
      setPhase('recognizing');

      const blob = await assetToBlob(asset);
      const out = await recognizePdf(blob, asset.name ?? 'document.pdf', session());
      setMarkdown(out.markdown);
      setPhase('review');
    } catch (e) {
      setError(friendly(e));
      setPhase('pick');
    }
  }

  async function makeCards() {
    setError(null);
    setPhase('generating');
    try {
      const out = await generateCards({ text: markdown }, session());
      setDrafts(
        out.cards.map((c: GeneratedCard) => ({ key: uid(), front: c.front, back: c.back })),
      );
      setPhase('drafts');
    } catch (e) {
      setError(friendly(e));
      setPhase('review');
    }
  }

  function updateDraft(key: string, patch: Partial<Draft>) {
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }
  function removeDraft(key: string) {
    setDrafts((ds) => ds.filter((d) => d.key !== key));
  }
  function addDraft() {
    setDrafts((ds) => [...ds, { key: uid(), front: '', back: '' }]);
  }

  async function save(intoDeckId: string) {
    setPhase('saving');
    try {
      const pairs = drafts
        .filter((d) => d.front.trim() && d.back.trim())
        .map((d) => ({ front: d.front.trim(), back: d.back.trim() }));
      await useAppStore.getState().addCards(intoDeckId, pairs);
      await useAppStore.getState().loadDecks();
      router.replace(`/deck/${intoDeckId}`);
    } catch (e) {
      setError(friendly(e));
      setPhase('drafts');
    }
  }

  async function onSavePressed() {
    if (deckId) {
      await save(String(deckId));
    } else {
      setAskTitle(true);
    }
  }

  async function createDeckAndSave(title: string) {
    setAskTitle(false);
    const deck = await useAppStore.getState().createDeck(title);
    await save(deck.id);
  }

  const validCount = drafts.filter((d) => d.front.trim() && d.back.trim()).length;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {phase === 'pick' && (
          <View style={styles.block}>
            <Text style={styles.lead}>
              Выберите PDF — мы распознаем текст и предложим карточки.
            </Text>
            <Button title="Выбрать PDF" onPress={pickAndRecognize} full />
          </View>
        )}

        {phase === 'recognizing' && <Loading label={`Распознаём ${fileName}…`} />}
        {phase === 'generating' && <Loading label="Генерируем карточки…" />}
        {phase === 'saving' && <Loading label="Сохраняем…" />}

        {phase === 'review' && (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>Распознанный текст</Text>
            <Card variant="alt" style={styles.mdBox}>
              <Text style={styles.md}>{markdown || 'Текст не найден.'}</Text>
            </Card>
            <Button title="Сделать карточки" onPress={makeCards} disabled={!markdown} full />
            <Button title="Выбрать другой файл" variant="ghost" onPress={() => setPhase('pick')} full />
          </View>
        )}

        {phase === 'drafts' && (
          <View style={styles.block}>
            <Text style={styles.sectionTitle}>
              Черновик карточек ({validCount})
            </Text>
            {drafts.map((d, i) => (
              <Card key={d.key} style={styles.draft}>
                <View style={styles.draftHeader}>
                  <Text style={styles.draftNum}>#{i + 1}</Text>
                  <Pressable onPress={() => removeDraft(d.key)} hitSlop={8}>
                    <Text style={styles.removeText}>Удалить</Text>
                  </Pressable>
                </View>
                <TextField
                  value={d.front}
                  onChangeText={(t) => updateDraft(d.key, { front: t })}
                  placeholder="Вопрос"
                  multiline
                />
                <TextField
                  value={d.back}
                  onChangeText={(t) => updateDraft(d.key, { back: t })}
                  placeholder="Ответ"
                  multiline
                  style={styles.gap}
                />
              </Card>
            ))}
            <Button title="＋ Добавить строку" variant="ghost" onPress={addDraft} full />
            <Button
              title={`Сохранить (${validCount})`}
              onPress={onSavePressed}
              disabled={validCount === 0}
              full
            />
          </View>
        )}
      </ScrollView>

      <PromptModal
        visible={askTitle}
        title="Новая колода"
        label="Название колоды"
        placeholder="Название"
        confirmLabel="Создать и сохранить"
        onCancel={() => setAskTitle(false)}
        onConfirm={createDeckAndSave}
      />
    </Screen>
  );
}

async function assetToBlob(asset: DocumentPicker.DocumentPickerAsset): Promise<Blob> {
  // On web the picker exposes a File directly; otherwise fetch the uri.
  if (Platform.OS === 'web' && asset.file) return asset.file;
  const resp = await fetch(asset.uri);
  return resp.blob();
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/network|fetch/i.test(msg)) return 'Нет соединения. Проверьте интернет.';
  return 'Не удалось обработать файл. Попробуйте ещё раз.';
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  block: { gap: spacing.md },
  lead: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 },
  sectionTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  error: { color: colors.danger, fontSize: fontSize.md },
  mdBox: { maxHeight: 280 },
  md: { color: colors.text, fontSize: fontSize.sm, lineHeight: 20 },
  draft: { gap: spacing.sm },
  draftHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  draftNum: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '700' },
  removeText: { color: colors.danger, fontSize: fontSize.sm },
  gap: { marginTop: spacing.xs },
});
