import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { FormError, SubmitButton } from '../components/form';
import { formatStored, OTP_LENGTH, useAuth } from '../auth';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

/**
 * OTP verification (§3.2, §9.1).
 *
 * The account is not created until the code matches, so this screen sits
 * between the sign-up form and a usable account.
 *
 * The code is never rendered here, and cannot be: `pending.delivery` carries no
 * code field, because the app never receives one. It exists in the user's inbox
 * and in the service that issued it, nowhere else. Verification is a round trip
 * to that service.
 */
export function OtpScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { pending, confirmSignUp, resendCode, cancelSignUp } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  if (!pending) return null;

  const destination =
    pending.channel === 'sms' ? formatStored(pending.storedPhone) : pending.email;

  const submit = async (value = code) => {
    setError(null);
    setBusy(true);
    try {
      await confirmSignUp(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vérification impossible.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const onChange = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    // Submitting on the last digit is what people expect from an OTP field.
    if (digits.length === OTP_LENGTH) submit(digits);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={cancelSignUp}
          accessibilityRole="button"
          accessibilityLabel={t('Retour')}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={styles.title}>{t('Vérification')}</Text>
        <Text style={styles.lede}>
          Nous avons envoyé un code à {OTP_LENGTH} chiffres à{' '}
          <Text style={styles.destination}>{destination}</Text>.
        </Text>

        {/* The boxes are the visual affordance; the real field is a single
            input laid over them, which is what accepts paste and the SMS
            autofill. It stays full-size and focusable — collapsing it to zero
            height would hide it from assistive technology as well as the eye. */}
        <View style={styles.otpWrap}>
          <View style={styles.boxes} importantForAccessibility="no-hide-descendants">
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <View key={i} style={[styles.box, i === code.length && styles.boxActive]}>
                <Text style={styles.boxDigit}>{code[i] ?? ''}</Text>
              </View>
            ))}
          </View>
          <TextInput
            ref={input}
            value={code}
            onChangeText={onChange}
            keyboardType="number-pad"
            inputMode="numeric"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={OTP_LENGTH}
            autoFocus
            caretHidden
            accessibilityLabel={t('Code de vérification')}
            style={styles.overlayInput}
          />
        </View>

        <View style={styles.sent}>
          <Icon name="solar:shield-check-bold" size={18} color={colors.success} />
          <Text style={styles.sentText}>
            Consultez votre boîte e-mail. Le code expire dans{' '}
            {Math.round(pending.delivery.expiresIn / 60)} minutes et ne peut servir qu'une fois.
            Pensez à vérifier vos courriers indésirables.
          </Text>
        </View>

        <FormError message={error} />
        <SubmitButton
          label={t('Vérifier')}
          onPress={() => submit()}
          busy={busy}
          disabled={code.length !== OTP_LENGTH}
          accessibilityLabel={t('Vérifier le code')}
        />

        <Pressable
          onPress={async () => {
            setCode('');
            setError(null);
            try {
              await resendCode();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Impossible d'envoyer un nouveau code.");
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Renvoyer le code')}
          style={styles.resend}
        >
          <Text style={styles.resendText}>{t("Vous n'avez rien reçu ?")}<Text style={styles.resendLink}>{t('Renvoyer le code')}</Text>
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
  destination: { fontFamily: fonts.sansBold, color: colors.foreground },
  otpWrap: { position: 'relative' },
  boxes: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  // Transparent text over the boxes: the digits are drawn by the boxes, but the
  // input keeps its real size so it can be focused, pasted into and tested.
  overlayInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    fontSize: 22,
    textAlign: 'center',
  },
  box: {
    flex: 1,
    height: 58,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.foreground },
  boxDigit: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.foreground },
  sent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: 'rgba(21,128,61,0.22)',
  },
  sentText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 18, color: colors.success },
  resend: { alignItems: 'center', paddingVertical: 4 },
  resendText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  resendLink: { fontFamily: fonts.sansBold, color: colors.foreground },
});
