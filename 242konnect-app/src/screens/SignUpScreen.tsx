import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { Field, FormError, PhoneField, SubmitButton } from '../components/form';
import { normalizePhone, useAuth, type AccountRole } from '../auth';
import type { AuthStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Inscription'>;

const ROLES: { id: AccountRole; label: string; hint: string; icon: 'solar:user-rounded-linear' | 'mdi:wrench' }[] = [
  { id: 'client', label: 'Je cherche un service', hint: 'Trouver un professionnel', icon: 'solar:user-rounded-linear' },
  { id: 'pro', label: 'Je suis professionnel', hint: 'Recevoir des missions', icon: 'mdi:wrench' },
];

export function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [role, setRole] = useState<AccountRole>('client');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await signUp({ name, phone, password, role });
      // No navigation here: the root navigator swaps to the app once an
      // account exists, so pushing a screen would fight it.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le compte.');
    } finally {
      setBusy(false);
    }
  };

  const ready = name.trim().length >= 2 && normalizePhone(phone).length === 9 && password.length >= 6;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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

        <Text style={styles.title}>Créer votre compte</Text>
        <Text style={styles.lede}>
          Votre numéro sert d'identifiant : c'est par là que les professionnels vous joignent.
        </Text>

        <View style={styles.roles}>
          {ROLES.map((option) => {
            const selected = role === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setRole(option.id)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                style={[styles.role, selected && styles.roleSelected]}
              >
                <Icon
                  name={option.icon}
                  size={22}
                  color={selected ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.roleLabel, selected && styles.roleLabelSelected]}>{option.label}</Text>
                <Text style={styles.roleHint}>{option.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        {role === 'pro' && (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              L'espace professionnel arrive bientôt. Votre compte sera créé et vous pourrez déjà
              parcourir l'application.
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Field
            label="Nom complet"
            value={name}
            onChangeText={setName}
            placeholder="Estevao Macumba"
            autoCapitalize="words"
            textContentType="name"
          />
          <PhoneField value={phone} onChangeText={(v) => setPhone(v)} />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            placeholder="6 caractères minimum"
            secureTextEntry
            textContentType="newPassword"
            onSubmitEditing={submit}
          />
          <FormError message={error} />
          <SubmitButton label="Créer mon compte" onPress={submit} busy={busy} disabled={!ready} />
        </View>

        <Pressable
          onPress={() => navigation.navigate('Connexion')}
          accessibilityRole="button"
          accessibilityLabel="J'ai déjà un compte, se connecter"
          style={styles.altRow}
        >
          <Text style={styles.altText}>
            Vous avez déjà un compte ? <Text style={styles.altLink}>Se connecter</Text>
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
  roles: { flexDirection: 'row', gap: 12 },
  role: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  roleSelected: { borderColor: colors.primary, backgroundColor: colors.muted },
  roleLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  roleLabelSelected: { color: colors.primary },
  roleHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  note: {
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(255,203,5,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,203,5,0.4)',
  },
  noteText: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 19, color: colors.foreground },
  form: { gap: 14 },
  altRow: { alignItems: 'center', paddingVertical: 8 },
  altText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  altLink: { fontFamily: fonts.sansBold, color: colors.primary },
});
