import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { useAuthStore } from '@/src/store/auth';
import { Screen, TextField, Button, Card } from '@/src/components';
import { colors, spacing, fontSize } from '@/src/theme';

const BOT = '@alrevion_verification_bot';

function hasPendingContact(telegram: unknown): boolean {
  return (
    !!telegram &&
    typeof telegram === 'object' &&
    'pending_contact' in (telegram as Record<string, unknown>) &&
    !!(telegram as Record<string, unknown>).pending_contact
  );
}

export default function LoginScreen() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitPhone() {
    const value = phone.trim();
    if (!/^\+\d{7,15}$/.test(value)) {
      setError('Введите номер в формате +79991234567');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await useAuthStore.getState().login(value);
      setPending(hasPendingContact(res.telegram));
      setStep('code');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }

  async function submitCode() {
    const value = code.trim();
    if (!/^\d{6}$/.test(value)) {
      setError('Код состоит из 6 цифр');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await useAuthStore.getState().verify(phone.trim(), value);
      // On success the auth store flips status to signedIn; the root layout
      // redirects into the app automatically.
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    setLoading(true);
    try {
      const res = await useAuthStore.getState().login(phone.trim());
      setPending(hasPendingContact(res.telegram));
    } catch (e) {
      setError(friendly(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen keyboardAvoiding>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Nemor</Text>
          <Text style={styles.subtitle}>Карточки для учёбы с умным повтором</Text>
        </View>

        {step === 'phone' ? (
          <View style={styles.form}>
            <TextField
              label="Номер телефона"
              value={phone}
              onChangeText={setPhone}
              placeholder="+79991234567"
              keyboardType="phone-pad"
              autoFocus
              hint="В международном формате (E.164)"
              error={error}
              returnKeyType="go"
              onSubmitEditing={submitPhone}
            />
            <Button
              title="Получить код"
              onPress={submitPhone}
              loading={loading}
              full
            />
          </View>
        ) : (
          <View style={styles.form}>
            {pending ? (
              <Card variant="alt" style={styles.notice}>
                <Text style={styles.noticeTitle}>Подтвердите номер в Telegram</Text>
                <Text style={styles.noticeText}>
                  Откройте бота {BOT} и нажмите «Поделиться контактом», чтобы
                  получить код подтверждения.
                </Text>
                <Button
                  title="Открыть бота"
                  variant="secondary"
                  onPress={() =>
                    Linking.openURL(`https://t.me/${BOT.replace('@', '')}`)
                  }
                />
              </Card>
            ) : (
              <Text style={styles.codeHint}>
                Код отправлен в Telegram на номер {phone.trim()}
              </Text>
            )}
            <TextField
              label="Код из Telegram"
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textAlign="center"
              error={error}
              returnKeyType="done"
              onSubmitEditing={submitCode}
            />
            <Button title="Войти" onPress={submitCode} loading={loading} full />
            <View style={styles.row}>
              <Button
                title="Изменить номер"
                variant="ghost"
                onPress={() => {
                  setStep('phone');
                  setCode('');
                  setError(null);
                }}
                style={styles.flex}
              />
              <Button
                title="Отправить снова"
                variant="ghost"
                onPress={resend}
                disabled={loading}
                style={styles.flex}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/network|fetch/i.test(msg)) return 'Нет соединения. Проверьте интернет.';
  if (/code|invalid|verify/i.test(msg)) return 'Неверный код. Попробуйте ещё раз.';
  return 'Что-то пошло не так. Попробуйте ещё раз.';
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.xl, paddingVertical: spacing.xl },
  header: { alignItems: 'center', gap: spacing.xs },
  brand: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  form: { gap: spacing.md },
  notice: { gap: spacing.sm },
  noticeTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  noticeText: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 },
  codeHint: { color: colors.textMuted, fontSize: fontSize.md, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
