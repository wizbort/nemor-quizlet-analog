import { Pressable, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { colors, radius, spacing, fontSize } from '@/src/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  full?: boolean;
}

const bgFor: Record<ButtonVariant, string> = {
  primary: colors.accent,
  secondary: colors.surfaceAlt,
  ghost: 'transparent',
  danger: colors.danger,
};

const textColorFor: Record<ButtonVariant, string> = {
  primary: '#ffffff',
  secondary: colors.text,
  ghost: colors.accent,
  danger: '#ffffff',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  full,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bgFor[variant] },
        variant === 'ghost' && styles.ghostBorder,
        full && styles.full,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={textColorFor[variant]} />
        ) : (
          <Text style={[styles.label, { color: textColorFor[variant] }]} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  ghostBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
