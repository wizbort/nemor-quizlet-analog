import { Stack } from 'expo-router';
import { colors, fontSize } from '@/src/theme';

// Authed area. A Stack with a themed header; individual screens set their
// own title / header buttons.
export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Колоды' }} />
      <Stack.Screen name="deck/[id]" options={{ title: 'Колода' }} />
      <Stack.Screen name="study/[deckId]" options={{ title: 'Учить' }} />
      <Stack.Screen name="quiz/[deckId]" options={{ title: 'Тест' }} />
      <Stack.Screen name="import" options={{ title: 'Импорт PDF' }} />
      <Stack.Screen name="settings" options={{ title: 'Настройки' }} />
    </Stack>
  );
}
