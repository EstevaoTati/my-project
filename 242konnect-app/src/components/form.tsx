import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Icon } from './Icon';
import {
  COUNTRIES,
  countryFor,
  formatNational,
  normalizeNational,
  type CountryCode,
} from '../countries';
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
  /** Selected dial code. */
  country: CountryCode;
  onCountryChange: (code: CountryCode) => void;
  error?: string;
  onSubmitEditing?: () => void;
  label?: string;
};

/**
 * Phone entry with a country picker.
 *
 * The dial code used to be a fixed, unselectable "+242", which locked sign-up
 * to Congolese numbers. The founder asked for the country to be selectable —
 * "🇨🇬 +242, 🇺🇸 +1, etc." — so it is now a button opening the served countries,
 * and the digits are grouped and length-checked per country rather than always
 * as nine Congolese ones.
 */
export function PhoneField({
  value,
  onChangeText,
  country,
  onCountryChange,
  error,
  onSubmitEditing,
  label = 'Numéro de téléphone',
}: PhoneFieldProps) {
  const [picking, setPicking] = useState(false);
  const selected = countryFor(country);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.phoneRow, !!error && styles.inputError]}>
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`Indicatif pays : +${selected.dial}. Changer de pays`}
          style={styles.prefix}
        >
          <Text style={styles.prefixText}>
            {selected.flag} +{selected.dial}
          </Text>
          <Icon name="solar:alt-arrow-down-linear" size={14} color={colors.mutedForeground} />
        </Pressable>
        <TextInput
          value={formatNational(value, country)}
          onChangeText={(next) => onChangeText(normalizeNational(next, country))}
          onSubmitEditing={onSubmitEditing}
          keyboardType="phone-pad"
          inputMode="tel"
          textContentType="telephoneNumber"
          // Room for the spaces the formatter adds.
          maxLength={selected.nationalDigits + selected.grouping.length}
          placeholder={selected.example}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={label}
          style={styles.phoneInput}
        />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Modal visible={picking} animationType="fade" transparent onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicking(false)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Indicatif du pays</Text>
            <ScrollView>
              {COUNTRIES.map((c) => {
                const active = c.code === country;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      onCountryChange(c.code);
                      // The old digits belong to the old numbering plan.
                      onChangeText('');
                      setPicking(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.nameFr}, +${c.dial}`}
                    accessibilityState={{ selected: active }}
                    style={[styles.countryRow, active && styles.countryRowActive]}
                  >
                    <Text style={styles.countryFlag}>{c.flag}</Text>
                    <Text style={styles.countryName}>{c.nameFr}</Text>
                    <Text style={styles.countryDial}>+{c.dial}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * A password field with a reveal toggle.
 *
 * Asked for directly: "prévoir un moyen simple de voir le mot de passe saisi".
 * Typing a password blind on a phone keyboard is where most sign-in failures
 * start, and hiding it protects nothing when the person is alone with their own
 * screen.
 */
export function PasswordField({
  label = 'Mot de passe',
  value,
  onChangeText,
  error,
  ...input
}: Omit<FieldProps, 'label'> & { label?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.phoneRow, !!error && styles.inputError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!shown}
          accessibilityLabel={label}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.phoneInput, styles.passwordInput]}
          {...input}
        />
        <Pressable
          onPress={() => setShown((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          hitSlop={8}
          style={styles.reveal}
        >
          <Text style={styles.revealText}>{shown ? 'Masquer' : 'Afficher'}</Text>
        </Pressable>
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
  passwordInput: { paddingRight: 4 },
  reveal: { paddingHorizontal: 12, justifyContent: 'center' },
  revealText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.mutedForeground },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheetCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    borderRadius: radius['2xl'],
    backgroundColor: colors.card,
    padding: 18,
    gap: 8,
    ...shadow.lg,
  },
  sheetTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    color: colors.foreground,
    marginBottom: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  countryRowActive: { backgroundColor: colors.muted },
  countryFlag: { fontSize: 20 },
  countryName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  countryDial: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.mutedForeground },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
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
