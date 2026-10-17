import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '@/src/theme';

interface LoadingProps {
  label?: string;
  /** Fill the available space and center. Defaults true. */
  fill?: boolean;
}

export function Loading({ label, fill = true }: LoadingProps) {
  return (
    <View style={[styles.wrap, fill && styles.fill]}>
      <ActivityIndicator size="large" color={colors.accent} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  fill: { flex: 1, padding: spacing.lg },
  label: { color: colors.textMuted, fontSize: fontSize.md },
});
