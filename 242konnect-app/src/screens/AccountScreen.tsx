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
import { pro, useProMode } from '../proTheme';

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
  const { account, signOut, switchProfile, activateProfile, hasPin, startPinSetup, accountSynced } =
    useAuth();
  const { favoriteCount, city, bookings, payments } = useStore();

  // Mode Pro (proTheme.ts): the whole Profil screen turns anthracite while the
  // Prestataire profile is active, so the active hat is never in doubt.
  const proMode = useProMode();
  const s = proMode ? stylesPro : styles;
  const iconColor = proMode ? pro.accent : colors.primary;
  const mutedColor = proMode ? pro.muted : colors.mutedForeground;

  if (!account) return null;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>{t('Profil')}</Text>

      <View style={s.card}>
        <UserAvatar name={account.name} avatar={account.avatar} size={52} />
        <View style={s.identity}>
          <View style={s.nameRow}>
            <Text style={s.name}>{account.name}</Text>
            {proMode && (
              <View style={s.proPill}>
                <Text style={s.proPillLabel}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={s.phone}>{formatStored(account.phone)}</Text>
          <Text style={s.email} numberOfLines={1}>
            {account.email}
          </Text>
          {!!account.bio && (
            <Text style={s.bio} numberOfLines={2}>
              {account.bio}
            </Text>
          )}
        </View>
      </View>

      {/* §9.10: one account, several profiles, switched from here — not three
          separate accounts. Profiles not yet activated can be added in place. */}
      <View style={s.profiles}>
        <Text style={s.profilesLabel}>{t('Profil actif')}</Text>
        <View style={s.profileRow}>
          {(Object.keys(PROFILE_LABELS) as ProfileKind[]).map((kind) => {
            const active = account.activeProfile === kind;
            const owned = account.profiles.includes(kind);
            return (
              <Pressable
                key={kind}
                onPress={() =>
                  owned
                    ? switchProfile(kind)
                    : // Prestataire §01: never activated in one tap. The dossier
                      // lists what is needed, collects it and ends in the contract.
                      kind === 'prestataire'
                      ? navigation.navigate('DossierPrestataire')
                      : activateProfile(kind)
                }
                accessibilityRole="button"
                accessibilityLabel={
                  owned
                    ? `Profil ${PROFILE_LABELS[kind]}`
                    : kind === 'prestataire'
                      ? 'Offrir mes services'
                      : `Activer le profil ${PROFILE_LABELS[kind]}`
                }
                aria-selected={active}
                style={[s.profileChip, active && s.profileChipActive]}
              >
                <Text style={[s.profileChipLabel, active && s.profileChipLabelActive]}>
                  {PROFILE_LABELS[kind]}
                </Text>
                {!owned && (
                  <Text style={s.profileChipAdd}>
                    {kind === 'prestataire' ? t('+ offrir mes services') : t('+ activer')}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
        {/* Both profiles are live now. Prestataire used to be marked "en
            attente" and to swap the whole Accueil tab for a dashboard; it now
            keeps the marketplace and adds its own space below, so there is
            nothing to warn about. */}
        <Text style={s.profilesNote}>
          {account.activeProfile === 'prestataire'
            ? t(
                "Vous proposez vos services et vous pouvez aussi en réserver : l'accueil, la recherche et les réservations fonctionnent comme pour un particulier."
              )
            : t('Un seul compte, plusieurs profils. « Offrir mes services » crée un dossier Prestataire vérifié par 242Konnect, sans toucher à votre profil Client. Le mode Business se demande séparément.')}
        </Text>
      </View>

      {/* French and English, as the correction note asks for. Placed on the
          account screen rather than buried in settings: someone who needs
          English needs it on their first visit, not after finding a submenu. */}
      <View style={s.languages}>
        <Text style={s.profilesLabel}>{t('Langue')}</Text>
        <View style={s.profileRow}>
          {LANGUAGES.map((option) => {
            const active = option.code === language;
            return (
              <Pressable
                key={option.code}
                onPress={() => setLanguage(option.code)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                aria-selected={active}
                style={[s.profileChip, active && s.profileChipActive]}
              >
                <Text style={[s.profileChipLabel, active && s.profileChipLabelActive]}>
                  {option.flag}  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statValue}>{favoriteCount}</Text>
          <Text style={s.statLabel}>{t('Favoris')}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Text style={s.statValue}>{bookings.length}</Text>
          <Text style={s.statLabel}>{t('Missions')}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={[s.stat, s.statWide]}>
          <Text style={s.statCity} numberOfLines={1}>
            {city.split(',')[0]}
          </Text>
          <Text style={s.statLabel}>{t('Ville')}</Text>
        </View>
      </View>

      {/* An account that exists only on this phone is one uninstall away from
          being gone, so say so rather than letting it look saved. Silence here
          is what let verified sign-ups sit on devices and never reach the
          server. Nothing is claimed while the answer is still unknown (null). */}
      {accountSynced === false && (
        <View style={s.syncWarning}>
          <Icon name="solar:shield-check-bold" size={18} color={proMode ? pro.warning : colors.warning} />
          <Text style={s.syncWarningText}>
            {t(
              "Ce compte n'a pas encore pu être enregistré sur nos serveurs : il n'existe que sur cet appareil. Reconnectez-vous une fois en ligne pour le sauvegarder."
            )}
          </Text>
        </View>
      )}

      {payments.length > 0 && (
        <Text style={s.paymentsLine}>
          {payments.length} paiement{payments.length > 1 ? 's' : ''} enregistré
          {payments.length > 1 ? 's' : ''} sur cet appareil
        </Text>
      )}

      <View style={s.list}>
        <Pressable
          onPress={() => navigation.navigate('ModifierProfil')}
          accessibilityRole="button"
          accessibilityLabel={t('Modifier le profil')}
          style={({ pressed }) => [s.row, pressed && s.pressed]}
        >
          <Icon name="solar:user-rounded-linear" size={20} color={iconColor} />
          <Text style={s.rowLabel}>{t('Modifier le profil')}</Text>
          <Icon name="solar:arrow-right-bold" size={16} color={mutedColor} />
        </Pressable>
        {/* Only for accounts that actually have the profile: the dashboard reads
            `account.prestataire`, and offering it to a particulier would open a
            screen with nothing in it. */}
        {account.profiles.includes('prestataire') && (
          <Pressable
            onPress={() => navigation.navigate('EspacePrestataire')}
            accessibilityRole="button"
            accessibilityLabel={t('Espace Prestataire')}
            style={({ pressed }) => [s.row, pressed && s.pressed]}
          >
            <Icon name="mdi:wrench" size={20} color={iconColor} />
            <Text style={s.rowLabel}>{t('Espace Prestataire')}</Text>
            <Icon name="solar:arrow-right-bold" size={16} color={mutedColor} />
          </Pressable>
        )}
        <Pressable
          onPress={() => startPinSetup(hasPin)}
          accessibilityRole="button"
          accessibilityLabel={hasPin ? t('Changer mon code confidentiel') : t('Définir un code confidentiel')}
          style={({ pressed }) => [s.row, pressed && s.pressed]}
        >
          <Icon name="solar:shield-check-bold" size={20} color={iconColor} />
          <Text style={s.rowLabel}>
            {hasPin ? t('Changer mon code confidentiel') : t('Définir un code confidentiel')}
          </Text>
          <Icon name="solar:arrow-right-bold" size={16} color={mutedColor} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Confidentialite')}
          accessibilityRole="button"
          accessibilityLabel={t('Confidentialité')}
          style={({ pressed }) => [s.row, pressed && s.pressed]}
        >
          <Icon name="solar:shield-check-bold" size={20} color={iconColor} />
          <Text style={s.rowLabel}>{t('Confidentialité')}</Text>
          <Icon name="solar:arrow-right-bold" size={16} color={mutedColor} />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('FAQ')}
          accessibilityRole="button"
          accessibilityLabel={t('Questions fréquentes')}
          style={({ pressed }) => [s.row, pressed && s.pressed]}
        >
          <Icon name="solar:chat-round-dots-linear" size={20} color={iconColor} />
          <Text style={s.rowLabel}>{t('Questions fréquentes')}</Text>
          <Icon name="solar:arrow-right-bold" size={16} color={mutedColor} />
        </Pressable>
        {SOON.map((row) => (
          <View key={row.label} style={s.row}>
            <Icon name={row.icon} size={20} color={mutedColor} />
            <Text style={s.rowLabel}>{row.label}</Text>
            <Text style={s.rowSoon}>{t('Bientôt')}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel={t('Se déconnecter')}
        style={({ pressed }) => [s.signOut, pressed && s.pressed]}
      >
        <Text style={s.signOutLabel}>{t('Se déconnecter')}</Text>
      </Pressable>

      <Text style={s.disclaimer}>{t("Votre profil et votre mot de passe sont enregistrés sur nos serveurs : connectez-vous sur un autre appareil avec votre adresse e-mail, votre mot de passe puis votre code confidentiel.")}</Text>
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: pro.accent },
  proPillLabel: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 1, color: pro.accentText },
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
  syncWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: 'rgba(180,83,9,0.25)',
  },
  syncWarningText: {
    flex: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.warning,
  },
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

/** Mode Pro overrides, layered over `styles` key by key. */
const proOverrides: Partial<Record<keyof typeof styles, object>> = {
  root: { backgroundColor: pro.ground },
  title: { color: pro.text },
  card: { backgroundColor: pro.surface, borderColor: pro.line },
  name: { color: pro.text },
  phone: { color: pro.muted },
  email: { color: pro.muted },
  bio: { color: pro.muted },
  profiles: { backgroundColor: pro.surface, borderColor: pro.line },
  profilesLabel: { color: pro.muted },
  profileChip: { backgroundColor: pro.raised, borderColor: pro.line },
  profileChipActive: { backgroundColor: pro.accent, borderColor: pro.accent },
  profileChipLabel: { color: pro.text },
  profileChipLabelActive: { color: pro.accentText },
  profileChipAdd: { color: pro.muted },
  profilesNote: { color: pro.muted },
  stats: { backgroundColor: pro.surface, borderColor: pro.line },
  statDivider: { backgroundColor: pro.line },
  statValue: { color: pro.text },
  statCity: { color: pro.text },
  statLabel: { color: pro.muted },
  list: { backgroundColor: pro.surface, borderColor: pro.line },
  row: { borderBottomColor: pro.line },
  rowLabel: { color: pro.text },
  rowSoon: { color: pro.muted },
  paymentsLine: { color: pro.muted },
  syncWarning: { backgroundColor: pro.warningSurface, borderColor: 'rgba(251,191,36,0.3)' },
  syncWarningText: { color: pro.warning },
  signOut: { borderColor: pro.destructive },
  signOutLabel: { color: pro.destructive },
  disclaimer: { color: pro.muted },
};

const stylesPro = Object.fromEntries(
  Object.entries(styles).map(([key, value]) => [key, [value, proOverrides[key as keyof typeof styles]]])
) as unknown as typeof styles;
