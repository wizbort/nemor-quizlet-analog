import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, fontSize } from '@/src/theme';
import { TextField } from './TextField';
import { Button } from './Button';

interface PromptModalProps {
  visible: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  multiline?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

/** A small single-field modal dialog (create/rename). */
export function PromptModal({
  visible,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Сохранить',
  multiline,
  onCancel,
  onConfirm,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <TextField
            value={value}
            onChangeText={setValue}
            label={label}
            placeholder={placeholder}
            multiline={multiline}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => trimmed && onConfirm(trimmed)}
          />
          <View style={styles.actions}>
            <Button title="Отмена" variant="ghost" onPress={onCancel} style={styles.flex} />
            <Button
              title={confirmLabel}
              onPress={() => onConfirm(trimmed)}
              disabled={!trimmed}
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
  },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flex: { flex: 1 },
});
