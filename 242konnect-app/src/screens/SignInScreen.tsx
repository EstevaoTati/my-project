import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { FormError, Field, PhoneField, SubmitButton } from '../components/form';
import { normalizePhone, useAuth } from '../auth';
import type { AuthStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Connexion'>;

export function SignInScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn({ phone, password });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  const ready = normalizePhone(phone).length === 9 && password.length > 0;

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
        <Text style={styles.lede}>Connectez-vous avec le numéro utilisé à l'inscription.</Text>

        <View style={styles.form}>
          <PhoneField value={phone} onChangeText={setPhone} />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            secureTextEntry
            textContentType="password"
            onSubmitEditing={submit}
          />
          <FormError message={error} />
          <SubmitButton label="Se connecter" onPress={submit} busy={busy} disabled={!ready} />
        </View>

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
