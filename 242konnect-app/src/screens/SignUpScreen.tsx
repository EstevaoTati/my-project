import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { Field, FormError, PhoneField, SubmitButton } from '../components/form';
import { isValidEmail, normalizePhone, useAuth, type OtpChannel, type ProfileKind } from '../auth';
import type { IconName } from '../icons';
import type { AuthStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Inscription'>;

/**
 * The three profiles the cahier des charges defines (§2.2). They are profiles
 * on one account, not separate accounts — see auth.tsx.
 */
const PROFILES: { id: ProfileKind; label: string; hint: string; icon: IconName }[] = [
  { id: 'particulier', label: 'Particulier', hint: 'Je cherche un service', icon: 'solar:user-rounded-linear' },
  { id: 'prestataire', label: 'Prestataire', hint: 'Je propose mes compétences', icon: 'mdi:wrench' },
  { id: 'business', label: 'Business', hint: 'Pour mon entreprise', icon: '242k:briefcase' },
];

const CHANNELS: { id: OtpChannel; label: string }[] = [
  { id: 'sms', label: 'SMS' },
  { id: 'email', label: 'E-mail' },
];

export function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { startSignUp } = useAuth();

  const [profile, setProfile] = useState<ProfileKind>('particulier');
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      // Issues a code and moves to verification; the account is only created
      // once the code is confirmed (§3.2).
      await startSignUp({ name, phone, email, password, profile, channel });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le compte.');
    } finally {
      setBusy(false);
    }
  };

  const ready =
    name.trim().length >= 2 &&
    normalizePhone(phone).length === 9 &&
    isValidEmail(email) &&
    password.length >= 6;

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

        <Text style={styles.title}>Créer votre compte</Text>
        <Text style={styles.lede}>
          Un seul compte, un seul identifiant. Vous pourrez activer les autres profils plus tard
          sans créer un second compte.
        </Text>

        <Text style={styles.sectionLabel}>Je suis</Text>
        <View style={styles.profiles}>
          {PROFILES.map((option) => {
            const selected = profile === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setProfile(option.id)}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                style={[styles.profile, selected && styles.profileSelected]}
              >
                <Icon
                  name={option.icon}
                  size={22}
                  color={selected ? colors.accentForeground : colors.mutedForeground}
                />
                <Text style={[styles.profileLabel, selected && styles.profileLabelSelected]}>
                  {option.label}
                </Text>
                <Text style={[styles.profileHint, selected && styles.profileHintSelected]}>
                  {option.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {profile !== 'particulier' && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {profile === 'prestataire'
                ? "L'espace Prestataire (missions, revenus, Score 242K) n'est pas encore construit. Votre compte sera créé et vous pourrez déjà l'utiliser comme particulier."
                : "L'espace Business (établissements, collaborateurs, appels d'offres) n'est pas encore construit. Votre compte sera créé et vous pourrez déjà l'utiliser comme particulier."}
            </Text>
          </View>
        )}

        <View style={styles.form}>
          <Field label="Nom complet" value={name} onChangeText={setName} autoCapitalize="words" />
          <PhoneField value={phone} onChangeText={(v) => setPhone(normalizePhone(v))} />
          <Field
            label="Adresse e-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            inputMode="email"
            placeholder="vous@exemple.com"
          />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="6 caractères minimum"
          />

          <View style={styles.channel}>
            <Text style={styles.sectionLabel}>Recevoir le code de vérification par</Text>
            <View style={styles.channelRow}>
              {CHANNELS.map((option) => {
                const selected = channel === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setChannel(option.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={`Recevoir le code par ${option.label}`}
                    accessibilityState={{ selected }}
                    style={[styles.channelChip, selected && styles.channelChipSelected]}
                  >
                    <Text style={[styles.channelLabel, selected && styles.channelLabelSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <FormError message={error} />
          <SubmitButton
            label="Créer mon compte"
            onPress={submit}
            busy={busy}
            disabled={!ready}
            accessibilityLabel="Créer mon compte"
          />

          <Pressable
            onPress={() => navigation.navigate('Connexion')}
            accessibilityRole="button"
            accessibilityLabel="J'ai déjà un compte, se connecter"
            style={styles.altRow}
          >
            <Text style={styles.altText}>
              J'ai déjà un compte · <Text style={styles.altLink}>Se connecter</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, gap: 14 },
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
  lede: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  sectionLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  profiles: { flexDirection: 'row', gap: 8 },
  profile: {
    flex: 1,
    padding: 12,
    gap: 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  profileSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  profileLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  profileLabelSelected: { color: colors.accentForeground },
  profileHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  profileHintSelected: { color: 'rgba(10,10,10,0.7)' },
  notice: {
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: 'rgba(180,83,9,0.25)',
  },
  noticeText: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 18, color: colors.warning },
  form: { gap: 14 },
  channel: { gap: 8 },
  channelRow: { flexDirection: 'row', gap: 8 },
  channelChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  channelChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  channelLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  channelLabelSelected: { color: colors.accentForeground },
  altRow: { alignItems: 'center', paddingVertical: 4 },
  altText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  altLink: { fontFamily: fonts.sansBold, color: colors.foreground },
});
