import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Icon } from './Icon';
import { formatPhone, PHONE_LENGTH } from '../auth';
import { colors, fonts, radius, shadow } from '../theme';

type FieldProps = TextInputProps & {
  label: string;
  /** Shown under the field; also marks the field as invalid. */
  error?: string;
};

export function Field({ label, error, style, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, !!error && styles.inputError, style]}
        {...input}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

type PhoneFieldProps = {
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  onSubmitEditing?: () => void;
};

/**
 * Phone entry with a fixed +242 prefix.
 *
 * The country code is shown but not editable: 242Konnect serves Congo-Brazzaville
 * only, so making it a free field would invite numbers the service can't reach.
 * Digits are grouped as they're typed the way people write them locally.
 */
export function PhoneField({ value, onChangeText, error, onSubmitEditing }: PhoneFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Numéro de téléphone</Text>
      <View style={[styles.phoneRow, !!error && styles.inputError]}>
        <View style={styles.prefix}>
          <Text style={styles.prefixText}>+242</Text>
        </View>
        <TextInput
          value={formatPhone(value)}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          keyboardType="phone-pad"
          inputMode="tel"
          textContentType="telephoneNumber"
          maxLength={PHONE_LENGTH + 3} // room for the spaces the formatter adds
          placeholder="06 123 45 67"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Numéro de téléphone"
          style={styles.phoneInput}
        />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export function SubmitButton({
  label,
  onPress,
  busy,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      style={({ pressed }) => [styles.submit, off && styles.submitOff, pressed && !off && styles.pressed]}
    >
      <Text style={styles.submitLabel}>{busy ? 'Un instant…' : label}</Text>
    </Pressable>
  );
}

/** Form-level failure, distinct from a per-field validation message. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Icon name="solar:shield-check-bold" size={18} color={colors.destructive} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  input: {
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  inputError: { borderColor: colors.destructive },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  prefix: {
    height: '100%',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.muted,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  prefixText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  submit: {
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.primaryGlow,
  },
  submitOff: { backgroundColor: colors.mutedForeground, opacity: 0.5, shadowOpacity: 0 },
  submitLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.primaryForeground },
  pressed: { opacity: 0.9 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(237,28,36,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(237,28,36,0.25)',
  },
  bannerText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.destructive },
});
