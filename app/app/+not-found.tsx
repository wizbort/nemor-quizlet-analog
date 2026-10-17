import { useRouter, Stack } from 'expo-router';
import { Screen, EmptyState } from '@/src/components';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Не найдено' }} />
      <EmptyState
        icon="🧭"
        title="Страница не найдена"
        message="Похоже, такого экрана не существует."
        actionLabel="На главную"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
