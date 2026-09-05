import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { CodeField } from '../components/CodeField';
import { FormError, SubmitButton } from '../components/form';
import { useAuth } from '../auth';
import { PIN_LENGTH, pinProblem } from '../pin';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

/**
 * Choosing the 6-digit PIN.
 *
 * Offered right after an account is created, and again from the account screen.
 * Skippable on purpose: an account without a PIN still works — it just falls
 * back to the mailed code at every sign-in. Forcing a PIN on someone at the end
 * of a long sign-up is how people end up choosing 123456.
 *
 * The PIN is typed twice, and neither copy is stored on the device. Both go to
 * the `pin` Edge Function, which is the only place that can hash or compare
 * them.
 */
export function SetPinScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { pendingPinSetup, definePin, skipPinSetup } = useAuth();

  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingPinSetup) return null;
  const replacing = pendingPinSetup.replacing;

  const problem = pin.length === PIN_LENGTH ? pinProblem(pin) : null;
  const mismatch = confirm.length === PIN_LENGTH && confirm !== pin;
  const ready =
    pin.length === PIN_LENGTH &&
    confirm === pin &&
    !problem &&
    (!replacing || current.length === PIN_LENGTH);

  const submit = async () => {
    if (!ready) return;
    setError(null);
    setBusy(true);
    try {
      await definePin(pin, replacing ? current : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de définir le code.');
      setPin('');
      setConfirm('');
      setCurrent('');
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
          onPress={skipPinSetup}
          accessibilityRole="button"
          accessibilityLabel={t('Retour')}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={styles.title}>
          {replacing ? t('Changer votre code') : t('Votre code confidentiel')}
        </Text>
        <Text style={styles.lede}>
          {t(
            'Six chiffres pour vous reconnecter sans attendre un e-mail. Choisissez un code que vous seul connaissez, et ne le notez pas sur votre téléphone.'
          )}
        </Text>

        {replacing && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('Code actuel')}</Text>
            <CodeField
              value={current}
              onChange={setCurrent}
              length={PIN_LENGTH}
              label={t('Code actuel')}
              secure
              autoFocus
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{replacing ? t('Nouveau code') : t('Nouveau code')}</Text>
          <CodeField
            value={pin}
            onChange={(next) => {
              setPin(next);
              setError(null);
            }}
            length={PIN_LENGTH}
            label={t('Nouveau code')}
            secure
            autoFocus={!replacing}
          />
          {problem && <Text style={styles.problem}>{problem}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('Confirmer le code')}</Text>
          <CodeField
            value={confirm}
            onChange={setConfirm}
            length={PIN_LENGTH}
            label={t('Confirmer le code')}
            secure
            onComplete={() => {
              if (ready) submit();
            }}
          />
          {mismatch && <Text style={styles.problem}>{t('Les deux codes ne correspondent pas.')}</Text>}
        </View>

        <View style={styles.note}>
          <Icon name="solar:shield-check-bold" size={18} color={colors.success} />
          <Text style={styles.noteText}>
            {t(
              "Le code n'est jamais enregistré sur cet appareil. Après cinq essais incorrects, il est bloqué quinze minutes."
            )}
          </Text>
        </View>

        <FormError message={error} />
        <SubmitButton
          label={replacing ? t('Changer mon code') : t('Définir mon code')}
          onPress={submit}
          busy={busy}
          disabled={!ready}
          accessibilityLabel={replacing ? t('Changer mon code') : t('Définir mon code')}
        />

        {!replacing && (
          <Pressable
            onPress={skipPinSetup}
            accessibilityRole="button"
            accessibilityLabel={t('Plus tard')}
            style={styles.skip}
          >
            <Text style={styles.skipText}>
              {t('Plus tard — je recevrai un code par e-mail à chaque connexion.')}
            </Text>
          </Pressable>
        )}
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
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.foreground },
  lede: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.mutedForeground },
  field: { gap: 8 },
  fieldLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  problem: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: 'rgba(21,128,61,0.22)',
  },
  noteText: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.success,
  },
  skip: { alignItems: 'center', paddingVertical: 4 },
  skipText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    textAlign: 'center',
    color: colors.mutedForeground,
  },
});
