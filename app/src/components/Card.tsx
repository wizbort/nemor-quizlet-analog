import { View, StyleSheet, Pressable } from 'react-native';
import type { ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/src/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  variant?: 'surface' | 'alt';
}

/** Themed surface container. Becomes pressable when `onPress` is given. */
export function Card({ children, onPress, style, variant = 'surface' }: CardProps) {
  const bg = variant === 'alt' ? colors.surfaceAlt : colors.surface;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: bg },
          pressed && styles.pressed,
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.8 },
});
