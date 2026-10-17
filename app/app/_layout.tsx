import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/src/theme';
import { useAuthStore } from '@/src/store/auth';
import { useAppStore } from '@/src/store/app';
import { Loading } from '@/src/components';

function useAuthGate() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();
  const syncedRef = useRef(false);

  useEffect(() => {
    void useAuthStore.getState().hydrate();
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(app)';

    if (status === 'signedOut') {
      syncedRef.current = false;
      if (segments[0] !== 'login') router.replace('/login');
      return;
    }

    // signedIn
    if (!inAuthGroup) router.replace('/(app)');
    if (!syncedRef.current) {
      syncedRef.current = true;
      void useAppStore.getState().sync().catch(() => {});
    }
  }, [status, segments, router]);

  return status;
}

export default function RootLayout() {
  const status = useAuthGate();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {status === 'loading' ? (
          <View style={styles.splash}>
            <Loading label="Загрузка…" />
          </View>
        ) : (
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { color: colors.text },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" options={{ title: 'Не найдено' }} />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, backgroundColor: colors.bg },
});
