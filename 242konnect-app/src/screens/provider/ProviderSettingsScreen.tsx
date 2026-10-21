import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { UserAvatar } from '../../components/Avatar';
import { useAuth } from '../../auth';
import type { IconName } from '../../icons';
import { getListing, type Listing } from '../../marketplace';
import type { SupabaseSession } from '../../supabase';
import { colors, fonts, radius } from '../../theme';
import { LANGUAGES, useI18n, useT } from '../../i18n';
import { useMarketData } from '../../components/online/shared';
import { tradeLabel } from './workspace';

type Nav = { navigate: (name: string) => void };

const loadListing = (session: SupabaseSession): Promise<Listing | null> => getListing(session, session.userId);

/**
 * Profil in provider mode — spec 14, mock-up "Profile & settings".
 *
 * Services, documents, payments, security and the way back to Client mode,
 * which keeps the same account and the professional file intact. Verified
 * name, phone and country change only through support (spec 02).
 */
export function ProviderSettingsScreen({ navigation }: { navigation: Nav }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useI18n();
  const { account, signOut, activateProfile, hasPin, startPinSetup } = useAuth();
  const { data: listing } = useMarketData(loadListing, 30000);
  const [error, setError] = useState<string | null>(null);
  if (!account) return null;

  const status = listing?.status;
  const verified = status === 'approved';
  const tradeId = listing?.tradeId ?? account.prestataire?.tradeId;

  const toClient = async () => {
    setError(null);
    try {
      await activateProfile('particulier');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Action impossible.'));
    }
  };

  const rows: { icon: IconName; label: string; onPress?: () => void }[] = [
    { icon: 'solar:user-rounded-linear', label: t('Modifier le profil professionnel'), onPress: () => navigation.navigate('ModifierProfil') },
    { icon: 'mdi:wrench', label: t('Services et tarifs'), onPress: () => navigation.navigate('ModifierProfil') },
    { icon: 'solar:shield-check-bold', label: t('Documents, contrat et vérification'), onPress: () => navigation.navigate('EspacePrestataire') },
    { icon: 'solar:tuning-square-2-bold', label: t('Moyens de versement') },
    { icon: 'solar:bell-bing-bold-duotone', label: t('Préférences de notification') },
    {
      icon: 'solar:shield-check-bold',
      label: hasPin ? t('Changer mon code confidentiel') : t('Définir un code confidentiel'),
      onPress: () => startPinSetup(hasPin),
    },
    { icon: 'solar:shield-check-bold', label: t('Confidentialité'), onPress: () => navigation.navigate('Confidentialite') },
    { icon: 'solar:chat-round-dots-linear', label: t('Aide et assistance'), onPress: () => navigation.navigate('FAQ') },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t('Profil et paramètres')}</Text>

      <View style={styles.card}>
        <UserAvatar name={account.name} avatar={account.avatar} size={64} />
        <View style={styles.identity}>
          <Text style={styles.name}>{account.name}</Text>
          {!!tradeId && <Text style={styles.meta}>{t(tradeLabel(tradeId))}</Text>}
          <View style={[styles.badge, verified ? styles.badgeOn : styles.badgeWait]}>
            <Text style={[styles.badgeLabel, verified ? styles.badgeLabelOn : styles.badgeLabelWait]}>
              {verified ? t('Prestataire vérifié') : status === 'refused' ? t('Profil refusé') : t('Vérification en cours')}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.modes} accessibilityRole="tablist" accessibilityLabel={t('Mode')}>
        <Pressable onPress={toClient} accessibilityRole="tab" aria-selected={false} accessibilityLabel={t('Mode client')} style={styles.mode}>
          <Icon name="solar:user-rounded-linear" size={18} color={colors.mutedForeground} />
          <Text style={styles.modeLabel}>{t('Mode client')}</Text>
        </Pressable>
        <View accessibilityRole="tab" aria-selected accessibilityLabel={t('Mode prestataire')} style={[styles.mode, styles.modeOn]}>
          <Icon name="mdi:wrench" size={18} color={colors.accentForeground} />
          <Text style={[styles.modeLabel, styles.modeLabelOn]}>{t('Mode prestataire')}</Text>
        </View>
      </View>
      <Text style={styles.small}>{t('Le mode client sert à commander un service avec le même compte. Votre dossier professionnel reste intact.')}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        onPress={() => navigation.navigate('EspacePrestataire')}
        accessibilityRole="button"
        accessibilityLabel={t('Suivi de la vérification')}
        style={[styles.verification, verified ? styles.verificationOn : styles.verificationWait]}
      >
        <Icon name="solar:shield-check-bold" size={24} color={verified ? colors.success : colors.warning} />
        <View style={styles.identity}>
          <Text style={styles.verificationTitle}>
            {t('Vérification du compte')} : {verified ? t('approuvée') : status === 'refused' ? t('refusée') : t('en cours')}
          </Text>
          <Text style={styles.meta}>
            {verified
              ? t('Votre compte est vérifié et visible des clients.')
              : status === 'refused'
                ? listing?.refusalReason ?? t('Corrigez votre profil pour repasser en examen.')
                : t('Les demandes arriveront après l’approbation.')}
          </Text>
        </View>
        <Icon name="solar:arrow-right-bold" size={16} color={colors.mutedForeground} />
      </Pressable>

      <View style={styles.list}>
        {rows.map((row) => (
          <Pressable
            key={row.label}
            onPress={row.onPress}
            disabled={!row.onPress}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowIcon}>
              <Icon name={row.icon} size={18} color={colors.foreground} />
            </View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.onPress ? (
              <Icon name="solar:arrow-right-bold" size={16} color={colors.mutedForeground} />
            ) : (
              <Text style={styles.soon}>{t('Bientôt')}</Text>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.languages}>
        <Text style={styles.sectionLabel}>{t('Langue')}</Text>
        <View style={styles.langRow}>
          {LANGUAGES.map((option) => {
            const active = option.code === language;
            return (
              <Pressable
                key={option.code}
                onPress={() => setLanguage(option.code)}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                aria-selected={active}
                style={[styles.lang, active && styles.langOn]}
              >
                <Text style={styles.langLabel}>
                  {option.flag}  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.note}>
        <Icon name="solar:shield-check-bold" size={16} color={colors.mutedForeground} />
        <Text style={styles.noteText}>{t('Votre nom, votre téléphone et votre pays vérifiés ne changent qu’avec l’accord du support.')}</Text>
      </View>

      <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel={t('Se déconnecter')} style={styles.signOut}>
        <Text style={styles.signOutLabel}>{t('Se déconnecter')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 140, gap: 14 },
  title: { fontFamily: fonts.headingBold, fontSize: 30, color: colors.foreground },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: colors.card, borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.border },
  identity: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  meta: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, marginTop: 2 },
  badgeOn: { backgroundColor: colors.successSurface },
  badgeWait: { backgroundColor: colors.warningSurface },
  badgeLabel: { fontFamily: fonts.sansBold, fontSize: 11 },
  badgeLabelOn: { color: colors.success },
  badgeLabelWait: { color: colors.warning },
  modes: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.full, padding: 4, gap: 4 },
  mode: { flex: 1, flexDirection: 'row', gap: 8, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  modeOn: { backgroundColor: colors.accent },
  modeLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.mutedForeground },
  modeLabelOn: { color: colors.accentForeground, fontFamily: fonts.sansBold },
  small: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.mutedForeground, marginTop: -6 },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  verification: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, borderWidth: 1 },
  verificationOn: { backgroundColor: colors.successSurface, borderColor: '#bbf7d0' },
  verificationWait: { backgroundColor: colors.warningSurface, borderColor: '#fde68a' },
  verificationTitle: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.muted },
  rowIcon: { width: 34, height: 34, borderRadius: radius.lg, backgroundColor: '#fff7d1', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  soon: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.mutedForeground },
  languages: { gap: 8 },
  sectionLabel: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.mutedForeground },
  langRow: { flexDirection: 'row', gap: 8 },
  lang: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  langOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  langLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.muted, borderRadius: radius.lg, padding: 10 },
  noteText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.mutedForeground },
  signOut: { height: 50, borderRadius: radius.xl, borderWidth: 1, borderColor: '#fecaca', backgroundColor: colors.destructiveSurface, alignItems: 'center', justifyContent: 'center' },
  signOutLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.destructive },
});
