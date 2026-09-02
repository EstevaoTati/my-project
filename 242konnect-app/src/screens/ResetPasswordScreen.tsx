import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Field, FormError, PasswordField, SubmitButton } from '../components/form';
import { MIN_PASSWORD, OTP_LENGTH, passwordProblem, useAuth } from '../auth';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

/**
 * "Mot de passe oublié ?" — recovery by the same code the rest of the app uses.
 *
 * One screen for both halves: the code that proves the address is yours, and
 * the new password. Splitting them across two screens buys nothing here, and
 * keeping the code visible while the password is typed avoids the round trip
 * back to the inbox that a two-step version invites.
 *
 * The address is only ever shown back, never asked for again, so this screen
 * cannot be used to test whether an address is registered.
 */
export function ResetPasswordScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { resetting, completePasswordReset, cancelPasswordReset } = useAuth();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!resetting) return null;

  const problem = password ? passwordProblem(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready =
    code.replace(/\D/g, '').length === OTP_LENGTH && !problem && password.length > 0 && confirm === password;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await completePasswordReset(code, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Réinitialisation impossible.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.root, styles.centred, { paddingTop: insets.top }]}>
        <View style={styles.doneIcon}>
          <Icon name="solar:shield-check-bold" size={34} color={colors.success} />
        </View>
        <Text style={styles.title}>{t('Mot de passe modifié')}</Text>
        <Text style={styles.lede}>{t('Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.')}</Text>
        <Pressable
          onPress={cancelPasswordReset}
          accessibilityRole="button"
          accessibilityLabel={t('Retourner à la connexion')}
          style={styles.cta}
        >
          <Text style={styles.ctaLabel}>{t('Se connecter')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={cancelPasswordReset}
          accessibilityRole="button"
          accessibilityLabel={t('Annuler')}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={styles.title}>{t('Nouveau mot de passe')}</Text>
        <Text style={styles.lede}>
          Un code à {OTP_LENGTH} chiffres a été envoyé à{' '}
          <Text style={styles.address}>{resetting.email}</Text>{t('. Saisissez-le, puis choisissez votre nouveau mot de passe.')}</Text>

        <View style={styles.form}>
          <Field
            label={t('Code reçu par e-mail')}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            placeholder="123456"
          />
          <PasswordField
            label={t('Nouveau mot de passe')}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            placeholder={`${MIN_PASSWORD} caractères minimum`}
            error={problem ?? undefined}
          />
          <PasswordField
            label={t('Confirmer')}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            onSubmitEditing={ready ? submit : undefined}
            error={mismatch ? 'Les deux mots de passe ne correspondent pas.' : undefined}
          />

          <FormError message={error} />
          <SubmitButton
            label={t('Modifier le mot de passe')}
            onPress={submit}
            busy={busy}
            disabled={!ready}
            accessibilityLabel={t('Modifier le mot de passe')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centred: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  scroll: { paddingHorizontal: 24, gap: 16 },
  back: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.foreground, textAlign: 'center' },
  lede: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  address: { fontFamily: fonts.sansBold, color: colors.foreground },
  form: { gap: 14, marginTop: 4 },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    height: 52,
    marginTop: 8,
    paddingHorizontal: 32,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryForeground },
});
