import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../auth';
import { formatAmount } from '../../pricing';
import type { RemoteRequest } from '../../marketplace';
import { colors, fonts, radius } from '../../theme';
import { useT } from '../../i18n';
import {
  availableRequests,
  AvailableToggle,
  earnedThisMonth,
  JOB_STATES,
  JobCard,
  jobs,
  JobSheet,
  RequestCard,
  RequestSheet,
  s as w,
  Segmented,
  StatTile,
  useWorkspace,
  type JobState,
} from './workspace';

/**
 * Provider dashboard — spec 08, mock-up "Provider dashboard".
 *
 * The home of provider mode. It replaces the client marketplace while the
 * Prestataire profile is active: the spec rules out browsing competitors in
 * provider mode (§14). Switching to Client mode in Profil brings the
 * marketplace back, on the same account.
 */
export function ProviderHomeScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const { account } = useAuth();
  const { data, error, refresh } = useWorkspace();
  const [tab, setTab] = useState<JobState>('accepted');
  const [viewing, setViewing] = useState<RemoteRequest | null>(null);
  const [job, setJob] = useState<RemoteRequest | null>(null);

  if (!account) return null;
  const listing = data?.listing ?? null;
  const available = availableRequests(data);
  const active = jobs(data).filter((r) => r.status === 'accepted');
  const myJobs = jobs(data, tab);
  const currency = account.location.country === 'US' ? 'USD' : 'FCFA';
  const initials = account.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.headerBody}>
            <Text style={styles.name} numberOfLines={1}>
              {account.name}
            </Text>
            <Text style={styles.role}>{t('Prestataire')}</Text>
          </View>
          <AvailableToggle listing={listing} onChanged={refresh} />
        </View>

        <Text style={styles.title}>{t('Tableau de bord')}</Text>
        <Text style={styles.lede}>{t('Gérez vos missions, trouvez de nouvelles demandes et développez votre activité.')}</Text>

        {listing && listing.status !== 'approved' && (
          <Pressable
            onPress={() => navigation.navigate('Profil', { screen: 'EspacePrestataire', initial: false })}
            accessibilityRole="button"
            accessibilityLabel={t('Suivi de la vérification')}
            style={styles.banner}
          >
            <Icon name="solar:shield-check-bold" size={20} color={colors.warning} />
            <Text style={styles.bannerText}>
              {listing.status === 'refused'
                ? t('Profil refusé : corrigez-le pour repasser en examen. Vous ne recevez pas de demandes en attendant.')
                : t('Profil en examen par 242Konnect : les demandes arriveront après l’approbation.')}
            </Text>
            <Icon name="solar:arrow-right-bold" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
        {listing && listing.status === 'approved' && !listing.available && (
          <View style={styles.banner}>
            <Icon name="solar:bell-bing-bold-duotone" size={20} color={colors.mutedForeground} />
            <Text style={styles.bannerText}>{t('Vous êtes indisponible : vos missions continuent, mais aucune nouvelle demande ne vous parvient.')}</Text>
          </View>
        )}
        {!!error && <Text style={w.error}>{error}</Text>}

        <View style={styles.stats}>
          <StatTile icon="solar:bell-bing-bold-duotone" label={t('Nouvelles demandes')} value={data ? String(available.length) : '–'} tint="#fff7d1" />
          <StatTile icon="mdi:wrench" label={t('Missions actives')} value={data ? String(active.length) : '–'} tint="#eef2ff" />
          <StatTile icon="solar:tuning-square-2-bold" label={t('Ce mois-ci')} value={data ? formatAmount(earnedThisMonth(data), currency) : '–'} tint={colors.successSurface} />
          <StatTile icon="solar:star-bold" label={t('Note')} value="–" tint="#f5f3ff" />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('Demandes près de vous')}</Text>
          <Pressable
            onPress={() => navigation.navigate('Missions', { tab: 'available' })}
            accessibilityRole="button"
            accessibilityLabel={t('Voir toutes les demandes')}
            style={styles.viewAll}
          >
            <Text style={styles.viewAllLabel}>{t('Tout voir')}</Text>
          </Pressable>
        </View>
        {data && available.length === 0 && (
          <Text style={styles.empty}>
            {listing?.status === 'approved'
              ? t('Aucune demande pour le moment. Les demandes de votre métier et de votre ville arrivent ici.')
              : t('Les demandes arriveront ici une fois votre profil approuvé.')}
          </Text>
        )}
        {available.slice(0, 2).map((r) => (
          <RequestCard key={r.id} request={r} onOpen={() => setViewing(r)} />
        ))}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('Mes missions')}</Text>
          <Pressable
            onPress={() => navigation.navigate('Missions', { tab: 'mine' })}
            accessibilityRole="button"
            accessibilityLabel={t('Voir toutes mes missions')}
            style={styles.viewAll}
          >
            <Text style={styles.viewAllLabel}>{t('Tout voir')}</Text>
          </Pressable>
        </View>
        <Segmented
          label={t('Mes missions')}
          options={JOB_STATES}
          value={tab}
          onChange={setTab}
        />
        {data && myJobs.length === 0 && <Text style={styles.empty}>{t('Aucune mission dans cet état.')}</Text>}
        {myJobs.slice(0, 3).map((r) => (
          <JobCard key={r.id} request={r} onOpen={() => setJob(r)} />
        ))}
      </ScrollView>

      <RequestSheet
        request={viewing}
        onClose={() => setViewing(null)}
        onDone={async (accepted) => {
          setViewing(null);
          await refresh();
          if (accepted) setJob(accepted);
        }}
      />
      <JobSheet request={job} address={job ? data?.addresses[job.id] : undefined} onClose={() => setJob(null)} onChanged={refresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 140, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff7d1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.foreground },
  headerBody: { flex: 1 },
  name: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  role: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  title: { fontFamily: fonts.headingBold, fontSize: 30, color: colors.foreground, marginTop: 6 },
  lede: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.mutedForeground, marginTop: -6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  bannerText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 17, color: colors.foreground },
  stats: { flexDirection: 'row', gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.foreground },
  viewAll: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  viewAllLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  empty: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
});
