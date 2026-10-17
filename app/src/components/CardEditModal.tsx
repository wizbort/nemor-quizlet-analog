import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, radius, spacing, fontSize } from '@/src/theme';
import { TextField } from './TextField';
import { Button } from './Button';

interface CardEditModalProps {
  visible: boolean;
  title: string;
  initialFront?: string;
  initialBack?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (front: string, back: string) => void;
}

/** Two-field modal for creating / editing a flashcard. */
export function CardEditModal({
  visible,
  title,
  initialFront = '',
  initialBack = '',
  confirmLabel = 'Сохранить',
  onCancel,
  onConfirm,
}: CardEditModalProps) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);

  useEffect(() => {
    if (visible) {
      setFront(initialFront);
      setBack(initialBack);
    }
  }, [visible, initialFront, initialBack]);

  const valid = front.trim().length > 0 && back.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={styles.fields}>
              <TextField
                label="Вопрос (лицо)"
                value={front}
                onChangeText={setFront}
                placeholder="Что на лицевой стороне?"
                multiline
                autoFocus
              />
              <TextField
                label="Ответ (оборот)"
                value={back}
                onChangeText={setBack}
                placeholder="Что на обороте?"
                multiline
              />
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <Button title="Отмена" variant="ghost" onPress={onCancel} style={styles.flex} />
            <Button
              title={confirmLabel}
              onPress={() => onConfirm(front.trim(), back.trim())}
              disabled={!valid}
              style={styles.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '85%',
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  fields: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
