import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useAuthStore } from '@/src/store/auth';
import { useAppStore } from '@/src/store/app';
import { Screen, Card, Button, SyncBadge, formatRelative } from '@/src/components';
import { colors, spacing, fontSize } from '@/src/theme';

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const syncStatus = useAppStore((s) => s.syncStatus);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const [syncing, setSyncing] = useState(false);

  const version =
    Constants.expoConfig?.version ?? (Constants as { manifest?: { version?: string } }).manifest?.version ?? '1.0.0';

  async function syncNow() {
    setSyncing(true);
    try {
      await useAppStore.getState().sync();
    } catch {
      Alert.alert('Ошибка', 'Не удалось синхронизировать. Попробуйте позже.');
    } finally {
      setSyncing(false);
    }
  }

  function confirmLogout() {
    Alert.alert('Выйти из аккаунта?', 'Локальные данные останутся на устройстве.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: () => {
          void useAuthStore.getState().logout();
        },
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.section}>
          <Text style={styles.label}>Телефон</Text>
          <Text style={styles.value}>{user?.phone ?? '—'}</Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.label}>Синхронизация</Text>
          <SyncBadge status={syncStatus} lastSyncedAt={lastSyncedAt} />
          <Text style={styles.muted}>Последняя: {formatRelative(lastSyncedAt)}</Text>
          <Button
            title="Синхронизировать сейчас"
            onPress={syncNow}
            loading={syncing}
            variant="secondary"
            full
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.label}>Версия приложения</Text>
          <Text style={styles.value}>{version}</Text>
        </Card>

        <Button title="Выйти" variant="danger" onPress={confirmLogout} full style={styles.logout} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  value: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  logout: { marginTop: spacing.md },
});
