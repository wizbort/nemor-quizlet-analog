import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/auth';
import { Screen, Loading } from '@/src/components';

// Entry route. Redirects based on auth status; the root layout also gates,
// this keeps the very first frame correct.
export default function Index() {
  const status = useAuthStore((s) => s.status);

  if (status === 'loading') {
    return (
      <Screen>
        <Loading label="Загрузка…" />
      </Screen>
    );
  }
  if (status === 'signedIn') return <Redirect href="/(app)" />;
  return <Redirect href="/login" />;
}
