import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { KeyboardTypeOptions, ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize } from '@/src/theme';

interface TextFieldProps {
  value: string;
  onChangeText: (t: string) => void;
  label?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoFocus?: boolean;
  multiline?: boolean;
  maxLength?: number;
  secureTextEntry?: boolean;
  editable?: boolean;
  hint?: string;
  error?: string | null;
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'next' | 'go' | 'send';
  style?: ViewStyle;
  textAlign?: 'left' | 'center';
}

export function TextField({
  value,
  onChangeText,
  label,
  placeholder,
  keyboardType,
  autoFocus,
  multiline,
  maxLength,
  secureTextEntry,
  editable = true,
  hint,
  error,
  onSubmitEditing,
  returnKeyType,
  style,
  textAlign = 'left',
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        multiline={multiline}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.multiline,
          { textAlign },
          focused && styles.focused,
          !!error && styles.errorBorder,
          !editable && styles.disabled,
        ]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: fontSize.lg,
    minHeight: 52,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: spacing.md },
  focused: { borderColor: colors.accent },
  errorBorder: { borderColor: colors.danger },
  disabled: { opacity: 0.6 },
  hint: { color: colors.textMuted, fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.sm },
});
