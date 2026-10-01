import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Scrollable page body. `safeTop` is for tab screens that have no header. */
export function Screen({
  children,
  safeTop = false,
  contentContainerStyle,
  ...rest
}: ScrollViewProps & { safeTop?: boolean }) {
  const theme = useTheme();
  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.screenContent, contentContainerStyle]}
      style={{ backgroundColor: theme.background }}
      {...rest}>
      {children}
    </ScrollView>
  );
  if (!safeTop) return body;
  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: theme.background }]}>
      {body}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'plain';

export function Button({
  title,
  variant = 'secondary',
  size = 'normal',
  style,
  disabled,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  title: string;
  variant?: ButtonVariant;
  size?: 'normal' | 'small' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const background = {
    primary: theme.accent,
    secondary: theme.backgroundSelected,
    danger: 'transparent',
    plain: 'transparent',
  }[variant];
  const color = {
    primary: theme.onAccent,
    secondary: theme.text,
    danger: theme.danger,
    plain: theme.accent,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        size === 'small' && styles.buttonSmall,
        size === 'large' && styles.buttonLarge,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
        style,
      ]}
      {...rest}>
      <ThemedText
        style={[{ color, fontWeight: 600 }, size === 'large' && { fontSize: 18 }]}
        type={size === 'small' ? 'small' : 'default'}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

export function TextField({ style, ...rest }: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.textSecondary}
      style={[
        styles.input,
        { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
        style,
      ]}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundSelected }, style]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: theme.accent }]}>
            <ThemedText
              type="smallBold"
              style={{ color: selected ? theme.onAccent : theme.textSecondary }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Wrapping row of pill toggles for picking one option or none. With
 * `noneLabel`, a leading chip stands for null; otherwise tapping the selected
 * chip clears it.
 */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  noneLabel,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  noneLabel?: string;
}) {
  const theme = useTheme();
  const items: { key: string; label: string; value: T | null }[] = [
    ...(noneLabel ? [{ key: '', label: noneLabel, value: null }] : []),
    ...options.map((o) => ({ key: o, label: o, value: o })),
  ];
  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(selected && !noneLabel ? null : item.value)}
            style={[
              styles.chip,
              { backgroundColor: selected ? theme.accent : theme.backgroundElement },
            ]}>
            <ThemedText
              type="small"
              style={{ color: selected ? theme.onAccent : theme.text, fontWeight: 600 }}>
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
      {children}
    </ThemedText>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <View style={styles.empty}>
      <ThemedText style={{ fontWeight: 600 }}>{title}</ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** A pressable list row with a title, optional subtitle, and optional right-hand text. */
export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
      ]}>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ? (
        <ThemedText type="small" themeColor="textSecondary">
          {right}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenContent: {
    padding: Spacing.three,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  button: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  buttonLarge: { paddingVertical: 16, borderRadius: 14 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
  },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16 },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.two },
  empty: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.five },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
