import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { FormError, PasswordField, SubmitButton } from '../components/form';
import { MIN_PASSWORD, passwordProblem, passwordStrength, useAuth } from '../auth';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

/**
 * The last step of sign-up: choosing a password, after the code has been
 * verified.
 *
 * This screen exists because of a specific complaint. The password used to be
 * collected in the first step, before verification, and the verification e-mail
 * naturally said nothing about it — so the screen appeared to be asking for a
 * password the e-mail should have supplied. Moving it here makes the sequence
 * the note asks for and removes the ambiguity: by the time a password is
 * requested, the person has already proved the address is theirs.
 *
 * The account does not exist until this screen succeeds.
 */

const STRENGTH_LABELS = ['Trop faible', 'Faible', 'Correct', 'Solide'];

export function CreatePasswordScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { pending, completeSignUp, cancelSignUp } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending) return null;

  const strength = passwordStrength(password);
  const problem = password ? passwordProblem(password) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = !problem && password.length > 0 && confirm === password;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await completeSignUp(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

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
          onPress={cancelSignUp}
          accessibilityRole="button"
          accessibilityLabel={t("Annuler l'inscription")}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <View style={styles.verified}>
          <Icon name="solar:shield-check-bold" size={18} color={colors.success} />
          <Text style={styles.verifiedText}>{t('Adresse vérifiée. Dernière étape : choisissez votre mot de passe.')}</Text>
        </View>

        <Text style={styles.title}>{t('Créer votre mot de passe')}</Text>
        <Text style={styles.lede}>
          Il protège votre compte 242Konnect. Au moins {MIN_PASSWORD} caractères, avec des lettres
          et des chiffres.
        </Text>

        <View style={styles.form}>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder={`${MIN_PASSWORD} caractères minimum`}
            autoCapitalize="none"
            error={problem ?? undefined}
          />

          {password.length > 0 && (
            <View style={styles.meter} accessibilityLabel={`Robustesse : ${STRENGTH_LABELS[strength]}`}>
              <View style={styles.meterTrack}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.meterSegment,
                      i < strength && styles.meterSegmentOn,
                      i < strength && strength === 3 && styles.meterSegmentStrong,
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.meterLabel}>{STRENGTH_LABELS[strength]}</Text>
            </View>
          )}

          <PasswordField
            label={t('Confirmer le mot de passe')}
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="none"
            onSubmitEditing={ready ? submit : undefined}
            error={mismatch ? 'Les deux mots de passe ne correspondent pas.' : undefined}
          />

          <FormError message={error} />
          <SubmitButton
            label={t('Créer mon compte')}
            onPress={submit}
            busy={busy}
            disabled={!ready}
            accessibilityLabel={t('Créer mon compte')}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: 'rgba(21,128,61,0.22)',
  },
  verifiedText: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.success,
  },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.foreground },
  lede: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedForeground,
    marginTop: -8,
  },
  form: { gap: 14, marginTop: 4 },
  meter: { gap: 6, marginTop: -6 },
  meterTrack: { flexDirection: 'row', gap: 6 },
  meterSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  meterSegmentOn: { backgroundColor: colors.warning },
  meterSegmentStrong: { backgroundColor: colors.success },
  meterLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
});
