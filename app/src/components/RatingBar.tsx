import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Rating } from '@/src/fsrs/scheduler';
import { colors, radius, spacing, fontSize } from '@/src/theme';

interface RatingBarProps {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
}

const BUTTONS: Array<{ rating: Rating; label: string; color: string }> = [
  { rating: Rating.Again, label: 'Снова', color: colors.danger },
  { rating: Rating.Hard, label: 'Трудно', color: colors.warning },
  { rating: Rating.Good, label: 'Хорошо', color: colors.accent },
  { rating: Rating.Easy, label: 'Легко', color: colors.success },
];

/** Four FSRS rating buttons: Снова / Трудно / Хорошо / Легко. */
export function RatingBar({ onRate, disabled }: RatingBarProps) {
  return (
    <View style={styles.row}>
      {BUTTONS.map((b) => (
        <Pressable
          key={b.rating}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          disabled={disabled}
          onPress={() => onRate(b.rating)}
          style={({ pressed }) => [
            styles.btn,
            { borderColor: b.color },
            pressed && !disabled && { backgroundColor: b.color },
            disabled && styles.disabled,
          ]}
        >
          <Text style={[styles.label, { color: b.color }]} numberOfLines={1}>
            {b.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
  },
  label: { fontSize: fontSize.md, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
