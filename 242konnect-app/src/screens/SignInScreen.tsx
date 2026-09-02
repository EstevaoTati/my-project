import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { FormError, Field, PasswordField, SubmitButton } from '../components/form';
import { DEMO_CREDENTIALS, DEMO_ENABLED, isValidEmail, useAuth } from '../auth';
import type { AuthStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Connexion'>;

export function SignInScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signIn, startPasswordReset } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn({ identifier, password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  // §3.2 allows signing in with either identifier. Any run of digits long
  // enough to be a phone number qualifies now that numbers are international,
  // and the exact country is worked out when the account is looked up.
  const digits = identifier.replace(/\D/g, '');
  const ready = (digits.length >= 9 || isValidEmail(identifier)) && password.length > 0;

  const forgot = async () => {
    setError(null);
    if (!identifier.trim()) {
      setError("Entrez d'abord votre numéro ou votre e-mail, puis touchez « Mot de passe oublié ».");
      return;
    }
    setBusy(true);
    try {
      await startPasswordReset(identifier);
    } catch (e) {
      // Includes the deliberately vague "if an account exists" reply, which is
      // shown as-is so an unknown address looks the same as a known one.
      setError(e instanceof Error ? e.message : 'Impossible de lancer la récupération.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={styles.title}>Bon retour</Text>
        <Text style={styles.lede}>Connectez-vous avec votre numéro ou votre adresse e-mail.</Text>

        <View style={styles.form}>
          <Field
            label="Numéro de téléphone ou e-mail"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            inputMode="email"
            placeholder="06 123 45 67 ou vous@exemple.com"
          />
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            textContentType="password"
            onSubmitEditing={submit}
          />

          <Pressable
            onPress={forgot}
            accessibilityRole="button"
            accessibilityLabel="Mot de passe oublié"
            hitSlop={6}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </Pressable>
          <FormError message={error} />
          <SubmitButton label="Se connecter" onPress={submit} busy={busy} disabled={!ready} />
        </View>

        {/* Preview builds only. Creating a new account still needs a real code
            by e-mail — this signs into an account that already exists. */}
        {DEMO_ENABLED && (
          <View style={styles.demo}>
            <Text style={styles.demoTitle}>Version de démonstration</Text>
            <Text style={styles.demoText}>
              Pour tester l'application sans attendre un e-mail, connectez-vous au compte de
              démonstration.
            </Text>
            <Pressable
              onPress={async () => {
                setError(null);
                setIdentifier(DEMO_CREDENTIALS.phone);
                setPassword(DEMO_CREDENTIALS.password);
                setBusy(true);
                try {
                  await signIn({
                    identifier: DEMO_CREDENTIALS.phone,
                    password: DEMO_CREDENTIALS.password,
                  });
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Connexion impossible.');
                } finally {
                  setBusy(false);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Se connecter avec le compte de démonstration"
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonLabel}>Ouvrir le compte de démonstration</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => navigation.navigate('Inscription')}
          accessibilityRole="button"
          accessibilityLabel="Créer un compte"
          style={styles.altRow}
        >
          <Text style={styles.altText}>
            Pas encore de compte ? <Text style={styles.altLink}>Créer un compte</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  forgotRow: { alignSelf: 'flex-end', paddingVertical: 2 },
  forgotText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.primary },
  demo: {
    padding: 14,
    gap: 6,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  demoText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  demoButton: {
    height: 46,
    marginTop: 4,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoButtonLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryForeground },
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
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.foreground, marginTop: 4 },
  lede: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.mutedForeground, marginTop: -8 },
  form: { gap: 14, marginTop: 8 },
  altRow: { alignItems: 'center', paddingVertical: 8 },
  altText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  altLink: { fontFamily: fonts.sansBold, color: colors.primary },
});
