import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { CodeField } from '../components/CodeField';
import { FormError, SubmitButton } from '../components/form';
import { useAuth } from '../auth';
import { PIN_LENGTH } from '../pin';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

/**
 * The PIN, as the second factor at sign-in.
 *
 * Reached when the password was right and this account has a PIN. It replaces
 * the mailed code, which is the point: waiting on an e-mail every single time
 * is what makes people turn two-factor off.
 *
 * Nothing is decided here. The digits go to the Edge Function, which owns the
 * comparison and the attempt count; this screen only renders its answer. The
 * way out is the same one that exists when someone forgets: fall back to the
 * mailed code, which proves the same address.
 */
export function PinScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { pendingSignIn, confirmPin, useEmailCodeInstead, cancelSignIn } = useAuth();

  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingSignIn) return null;

  const submit = async (value = pin) => {
    setError(null);
    setBusy(true);
    try {
      await confirmPin(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code incorrect.');
      setPin('');
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
          onPress={cancelSignIn}
          accessibilityRole="button"
          accessibilityLabel={t('Retour')}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={styles.title}>{t('Votre code confidentiel')}</Text>
        <Text style={styles.lede}>
          {t('Saisissez vos {digits} chiffres pour terminer la connexion.', { digits: PIN_LENGTH })}
        </Text>

        <CodeField
          value={pin}
          onChange={(next) => {
            setPin(next);
            setError(null);
          }}
          length={PIN_LENGTH}
          label={t('Code confidentiel')}
          secure
          autoFocus
          onComplete={submit}
        />

        <FormError message={error} />
        <SubmitButton
          label={t('Se connecter')}
          onPress={() => submit()}
          busy={busy}
          disabled={pin.length !== PIN_LENGTH}
          accessibilityLabel={t('Valider le code confidentiel')}
        />

        <Pressable
          onPress={async () => {
            setError(null);
            setSwitching(true);
            try {
              await useEmailCodeInstead();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Impossible d'envoyer un code.");
            } finally {
              setSwitching(false);
            }
          }}
          disabled={switching}
          accessibilityRole="button"
          accessibilityLabel={t('Recevoir un code par e-mail')}
          style={styles.fallback}
        >
          <Text style={styles.fallbackText}>
            {switching ? t('Envoi en cours…') : t('Code oublié ? Recevoir un code par e-mail')}
          </Text>
        </Pressable>
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
  fallback: { alignItems: 'center', paddingVertical: 6 },
  fallbackText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
});
