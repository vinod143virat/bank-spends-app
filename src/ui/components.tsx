import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { RADIUS, SPACE, TYPE, useTheme } from './theme';

// ------------------------------------------------------------------- text ---

type TextVariant = keyof typeof TYPE;
type Tone = 'primary' | 'secondary' | 'muted' | 'debit' | 'credit';

export function Txt({
  variant = 'body', tone = 'primary', style, children, numberOfLines, tabular,
}: {
  variant?: TextVariant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
  /** Only for columns that must align vertically - tables, axis ticks. */
  tabular?: boolean;
}) {
  const theme = useTheme();
  const color =
    tone === 'secondary' ? theme.textSecondary :
    tone === 'muted' ? theme.textMuted :
    tone === 'debit' ? theme.debit :
    tone === 'credit' ? theme.credit :
    theme.textPrimary;

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[TYPE[variant], { color }, tabular && styles.tabular, style]}>
      {children}
    </Text>
  );
}

// ----------------------------------------------------------------- layout ---

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ flex: 1, backgroundColor: theme.plane }, style]}>{children}</View>;
}

export function Card({
  children, style, padded = true, onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: RADIUS.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          padding: padded ? SPACE.lg : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="caption" tone="muted" style={styles.upper}>{title}</Txt>
      {action}
    </View>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

// ------------------------------------------------------------------ atoms ---

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Badge({
  label, color, subtle = true,
}: { label: string; color?: string; subtle?: boolean }) {
  const theme = useTheme();
  const tint = color ?? theme.textMuted;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: subtle ? withAlpha(tint, theme.mode === 'dark' ? 0.22 : 0.12) : tint,
          borderColor: withAlpha(tint, 0.35),
        },
      ]}>
      <Txt variant="caption" style={{ color: subtle ? tint : '#fff' }}>{label}</Txt>
    </View>
  );
}

/**
 * Segmented control for the date-range presets. Selection is carried by a
 * filled pill plus weight change, so it survives greyscale and forced colours.
 */
export function Segmented<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.surfaceSunken, borderColor: theme.border }]}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              active && {
                backgroundColor: theme.surfaceRaised,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}>
            <Txt variant={active ? 'bodyStrong' : 'body'} tone={active ? 'primary' : 'secondary'}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label, active, onPress, color,
}: { label: string; active?: boolean; onPress: () => void; color?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.textPrimary : theme.surface,
          borderColor: active ? theme.textPrimary : theme.border,
        },
        pressed && styles.pressed,
      ]}>
      {color ? <Dot color={color} size={7} /> : null}
      <Txt variant="label" style={{ color: active ? theme.plane : theme.textSecondary }}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Button({
  label, onPress, variant = 'primary', busy, disabled, style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isPrimary ? theme.textPrimary : variant === 'secondary' ? theme.surface : 'transparent',
          borderColor: variant === 'ghost' ? 'transparent' : isPrimary ? theme.textPrimary : theme.border,
          opacity: inactive ? 0.5 : 1,
        },
        pressed && styles.pressed,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator size="small" color={isPrimary ? theme.plane : theme.textPrimary} />
      ) : (
        <Txt variant="bodyStrong" style={{ color: isPrimary ? theme.plane : theme.textPrimary }}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

export function EmptyState({
  title, body, action,
}: { title: string; body: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyMark, { borderColor: theme.border, backgroundColor: theme.surface }]} />
      <Txt variant="heading" style={styles.centered}>{title}</Txt>
      <Txt variant="body" tone="secondary" style={[styles.centered, styles.emptyBody]}>{body}</Txt>
      {action}
    </View>
  );
}

/** Shimmerless placeholder. Motion during a data load is noise, not polish. */
export function Skeleton({ height = 16, width = '100%', style }: {
  height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[{ height, width, borderRadius: RADIUS.sm, backgroundColor: theme.surfaceSunken }, style]} />
  );
}

/** Hairline ring used to lift a coloured mark off an adjacent mark. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.65 },
  upper: { textTransform: 'uppercase' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.xs,
  },
  badge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  segmented: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.xl, gap: SPACE.sm },
  emptyMark: { width: 56, height: 56, borderRadius: RADIUS.lg, borderWidth: 1, marginBottom: SPACE.sm },
  centered: { textAlign: 'center' },
  emptyBody: { maxWidth: 300, marginBottom: SPACE.md },
});
