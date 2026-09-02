import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { formatStored, useAuth } from '../auth';
import { useStore } from '../store';
import { PROFILE_LABELS, type ProfileKind } from '../auth';
import { UserAvatar } from '../components/Avatar';
import type { AccountStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { LANGUAGES, T, useI18n, useT } from '../i18n';

/**
 * The Profil tab, once there's an account behind it.
 *
 * Rows that lead nowhere yet say so rather than doing nothing when tapped —
 * a setting that silently ignores you reads worse than one labelled as coming.
 */
const SOON = [
  { icon: 'solar:bell-bing-bold-duotone', label: T('Préférences de notification') },
  { icon: 'solar:shield-check-bold', label: T('Vérification du compte') },
] as const;

type Props = NativeStackScreenProps<AccountStackParamList, 'MonCompte'>;

export function AccountScreen({ navigation }: Props) {
  const t = useT();
  const { language, setLanguage } = useI18n();
  const insets = useSafeAreaInsets();
  const { account, signOut, switchProfile, activateProfile } = useAuth();
  const { favoriteCount, city, bookings, payments } = useStore();

  if (!account) return null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>{t('Profil')}</Text>

      <View style={styles.card}>
        <UserAvatar name={account.name} avatar={account.avatar} size={52} />
        <View style={styles.identity}>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.phone}>{formatStored(account.phone)}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {account.email}
          </Text>
          {!!account.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {account.bio}
            </Text>
          )}
        </View>
      </View>

      {/* §9.10: one account, several profiles, switched from here — not three
          separate accounts. Profiles not yet activated can be added in place. */}
      <View style={styles.profiles}>
        <Text style={styles.profilesLabel}>{t('Profil actif')}</Text>
        <View style={styles.profileRow}>
          {(Object.keys(PROFILE_LABELS) as ProfileKind[]).map((kind) => {
            const active = account.activeProfile === kind;
            const owned = account.profiles.includes(kind);
            return (
              <Pressable
                key={kind}
                onPress={() => (owned ? switchProfile(kind) : activateProfile(kind))}
                accessibilityRole="button"
                accessibilityLabel={
                  owned ? `Profil ${PROFILE_LABELS[kind]}` : `Activer le profil ${PROFILE_LABELS[kind]}`
                }
                accessibilityState={{ selected: active }}
                style={[styles.profileChip, active && styles.profileChipActive]}
              >
                <Text style={[styles.profileChipLabel, active && styles.profileChipLabelActive]}>
                  {PROFILE_LABELS[kind]}
                </Text>
                {!owned && <Text style={styles.profileChipAdd}>{t('+ activer')}</Text>}
                {kind !== 'particulier' && (
                  <Text style={styles.profileChipPending}>{t('en attente')}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
        {/* The founder's sequencing: finish Particulier first, then the other
            two. Their spaces exist but are explicitly on hold, so switching
            says so rather than looking half-finished. */}
        <Text style={styles.profilesNote}>
          {account.activeProfile === 'particulier'
            ? "L'espace Particulier est celui en cours de finalisation. Les espaces Prestataire et Business suivront."
            : `L'espace ${PROFILE_LABELS[account.activeProfile]} est en attente : il sera finalisé après l'espace Particulier.`}
        </Text>
      </View>

      {/* French and English, as the correction note asks for. Placed on the
          account screen rather than buried in settings: someone who needs
          English needs it on their first visit, not after finding a submenu. */}
      <View style={styles.languages}>
        <Text style={styles.profilesLabel}>{t('Langue')}</Text>
        <View style={styles.profileRow}>
          {LANGUAGES.map((option) => {
            const active = option.code === language;
            return (
              <Pressable
                key={option.code}
                onPress={() => setLanguage(option.code)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active }}
                style={[styles.profileChip, active && styles.profileChipActive]}
              >
                <Text style={[styles.profileChipLabel, active && styles.profileChipLabelActive]}>
                  {option.flag}  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{favoriteCount}</Text>
          <Text style={styles.statLabel}>{t('Favoris')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{bookings.length}</Text>
          <Text style={styles.statLabel}>{t('Missions')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={[styles.stat, styles.statWide]}>
          <Text style={styles.statCity} numberOfLines={1}>
            {city.split(',')[0]}
          </Text>
          <Text style={styles.statLabel}>{t('Ville')}</Text>
        </View>
      </View>

      {payments.length > 0 && (
        <Text style={styles.paymentsLine}>
          {payments.length} paiement{payments.length > 1 ? 's' : ''} enregistré
          {payments.length > 1 ? 's' : ''} sur cet appareil
        </Text>
      )}

      <View style={styles.list}>
        <Pressable
          onPress={() => navigation.navigate('ModifierProfil')}
          accessibilityRole="button"
          accessibilityLabel={t('Modifier le profil')}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Icon name="solar:user-rounded-linear" size={20} color={colors.primary} />
          <Text style={styles.rowLabel}>{t('Modifier le profil')}</Text>
          <Icon name="solar:arrow-right-bold" size={16} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('FAQ')}
          accessibilityRole="button"
          accessibilityLabel={t('Questions fréquentes')}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Icon name="solar:chat-round-dots-linear" size={20} color={colors.primary} />
          <Text style={styles.rowLabel}>{t('Questions fréquentes')}</Text>
          <Icon name="solar:arrow-right-bold" size={16} color={colors.mutedForeground} />
        </Pressable>
        {SOON.map((row) => (
          <View key={row.label} style={styles.row}>
            <Icon name={row.icon} size={20} color={colors.mutedForeground} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowSoon}>{t('Bientôt')}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel={t('Se déconnecter')}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Text style={styles.signOutLabel}>{t('Se déconnecter')}</Text>
      </Pressable>

      <Text style={styles.disclaimer}>{t("Ce compte est enregistré sur cet appareil uniquement. Il n'existe pas encore de serveur : vous ne pourrez pas vous connecter depuis un autre téléphone.")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 18, color: colors.primaryForeground },
  identity: { flex: 1 },
  name: { fontFamily: fonts.heading, fontSize: 17, color: colors.foreground },
  phone: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  bio: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 4 },
  email: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  profiles: {
    padding: 14,
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
  },
  profileChipPending: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.warning,
    marginTop: 1,
  },
  languages: { marginTop: 18, gap: 10 },
  profilesLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  profileRow: { flexDirection: 'row', gap: 8 },
  profileChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  profileChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  profileChipLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  profileChipLabelActive: { color: colors.accentForeground },
  profileChipAdd: { fontFamily: fonts.sans, fontSize: 10, color: colors.mutedForeground },
  profilesNote: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.warning },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  roleChipPro: { backgroundColor: colors.accent },
  roleChipText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.mutedForeground },
  roleChipTextPro: { color: colors.accentForeground },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statWide: { flex: 1.4 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  statValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.foreground },
  statCity: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground },
  statLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  list: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  rowSoon: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.mutedForeground },
  paymentsLine: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, textAlign: 'center' },
  signOut: {
    height: 52,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.destructive },
  pressed: { opacity: 0.85 },
  disclaimer: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
