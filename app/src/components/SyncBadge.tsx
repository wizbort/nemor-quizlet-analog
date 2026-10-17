import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, radius, spacing, fontSize } from '@/src/theme';
import type { SyncStatus } from '@/src/store/app';
import { formatRelative } from './ids';

interface SyncBadgeProps {
  status: SyncStatus;
  lastSyncedAt: number | null;
}

/** Compact pill showing current sync state + last sync time. */
export function SyncBadge({ status, lastSyncedAt }: SyncBadgeProps) {
  let dotColor = colors.textMuted;
  let text = `Синхр.: ${formatRelative(lastSyncedAt)}`;
  if (status === 'syncing') {
    dotColor = colors.accent;
    text = 'Синхронизация…';
  } else if (status === 'error') {
    dotColor = colors.danger;
    text = 'Ошибка синхронизации';
  } else if (status === 'synced') {
    dotColor = colors.success;
    text = `Синхр.: ${formatRelative(lastSyncedAt)}`;
  }

  return (
    <View style={styles.pill}>
      {status === 'syncing' ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      )}
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: colors.textMuted, fontSize: fontSize.sm },
});
