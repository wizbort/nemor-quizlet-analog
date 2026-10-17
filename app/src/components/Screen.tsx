import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/src/theme';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Apply horizontal + top padding. Defaults true. */
  padded?: boolean;
  /** Wrap in KeyboardAvoidingView (for forms). */
  keyboardAvoiding?: boolean;
}

/** Safe-area aware screen container with the app background. */
export function Screen({ children, style, padded = true, keyboardAvoiding }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const inner = (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          paddingHorizontal: padded ? spacing.md : 0,
          paddingTop: padded ? spacing.md : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );

  if (keyboardAvoiding) {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {inner}
      </KeyboardAvoidingView>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
});
