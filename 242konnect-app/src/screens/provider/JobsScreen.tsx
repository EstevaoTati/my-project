import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import type { RemoteRequest } from '../../marketplace';
import { colors, fonts, radius } from '../../theme';
import { T, useT } from '../../i18n';
import {
  availableRequests,
  AvailableToggle,
  DismissalCard,
  JOB_STATES,
  JobCard,
  jobs,
  JobSheet,
  jobState,
  RequestCard,
  RequestSheet,
  s as w,
  Segmented,
  tradeLabel,
  useWorkspace,
  type JobState,
} from './workspace';

type Tab = 'available' | 'mine' | 'history';

/**
 * Jobs — spec "Bouton Jobs" §1.1–1.4, mock-ups "Jobs" and "My jobs".
 *
 * Three views: requests this prestataire may take now, their missions by
 * state, and History (finished, cancelled, declined, lost to another
 * prestataire, expired). The filters a prestataire could set by hand —
 * country, city, trade — are fixed by their verified listing, which is what
 * the database filters on; the screen says so instead of offering choices
 * that could not change the result.
 */
export function JobsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const route = useRoute<{ key: string; name: string; params?: { tab?: Tab } }>();
  const { data, error, refresh } = useWorkspace();
  const [tab, setTab] = useState<Tab>(route.params?.tab ?? 'available');
  const [state, setState] = useState<JobState>('accepted');
  const [query, setQuery] = useState('');
  const [viewing, setViewing] = useState<RemoteRequest | null>(null);
  const [job, setJob] = useState<RemoteRequest | null>(null);

  // The dashboard's "Tout voir" lands on the right view.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const listing = data?.listing ?? null;
  const q = query.trim().toLowerCase();
  const matches = (r: RemoteRequest) =>
    !q ||
    [t(tradeLabel(r.tradeId)), r.zoneHint, r.city, r.description, r.id.slice(0, 8)].some((f) => f.toLowerCase().includes(q));
  const available = availableRequests(data).filter(matches);
  const mine = jobs(data, state);
  const history = jobs(data).filter((r) => {
    const s = jobState(r);
    return (s === 'completed' && r.status !== 'accepted') || s === 'cancelled';
  });

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('Missions')}</Text>
          <AvailableToggle listing={listing} onChanged={refresh} />
        </View>

        <Segmented
          label={t('Missions')}
          options={[
            { id: 'available' as const, label: T('Disponibles') },
            { id: 'mine' as const, label: T('Mes missions') },
            { id: 'history' as const, label: T('Historique') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {!!error && <Text style={w.error}>{error}</Text>}

        {tab === 'available' && (
          <>
            <View style={styles.search}>
              <Icon name="solar:magnifer-linear" size={18} color={colors.mutedForeground} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('Rechercher une demande')}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t('Rechercher une demande')}
                style={styles.searchInput}
              />
            </View>
            {listing && (
              <View style={styles.zone}>
                <Icon name="solar:map-point-bold" size={16} color={colors.foreground} />
                <Text style={styles.zoneText}>
                  {[listing.country === 'US' ? t('États-Unis') : t('République du Congo'), listing.city, t(tradeLabel(listing.tradeId))]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            )}
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('Demandes près de vous')}</Text>
              {data && <Text style={styles.count}>{t('{n} disponibles', { n: available.length })}</Text>}
            </View>
            {data && available.length === 0 && (
              <Text style={styles.empty}>
                {listing?.status !== 'approved'
                  ? t('Les demandes arriveront ici une fois votre profil approuvé.')
                  : listing.available
                    ? t('Aucune demande pour le moment. Les demandes de votre métier et de votre ville arrivent ici.')
                    : t('Vous êtes indisponible : aucune nouvelle demande ne vous parvient.')}
              </Text>
            )}
            {available.map((r) => (
              <RequestCard key={r.id} request={r} onOpen={() => setViewing(r)} />
            ))}
          </>
        )}

        {tab === 'mine' && (
          <>
            <Segmented
              label={t('Mes missions')}
              options={JOB_STATES}
              value={state}
              onChange={setState}
            />
            {data && mine.length === 0 && <Text style={styles.empty}>{t('Aucune mission dans cet état.')}</Text>}
            {mine.map((r) => (
              <JobCard key={r.id} request={r} onOpen={() => setJob(r)} />
            ))}
            <Text style={w.footnote}>
              {t('Une demande ouverte ne peut être acceptée que par un seul prestataire. Les demandes attribuées disparaissent aussitôt de la liste.')}
            </Text>
          </>
        )}

        {tab === 'history' && (
          <>
            {data && history.length === 0 && data.dismissals.length === 0 && (
              <Text style={styles.empty}>{t('Votre historique est vide.')}</Text>
            )}
            {history.map((r) => (
              <JobCard key={r.id} request={r} onOpen={() => setJob(r)} />
            ))}
            {data?.dismissals.map((d) => <DismissalCard key={d.requestId} item={d} />)}
          </>
        )}
      </ScrollView>

      <RequestSheet
        request={viewing}
        onClose={() => setViewing(null)}
        onDone={async (accepted) => {
          setViewing(null);
          await refresh();
          if (accepted) {
            setTab('mine');
            setState('accepted');
            setJob(accepted);
          }
        }}
      />
      <JobSheet request={job} address={job ? data?.addresses[job.id] : undefined} onClose={() => setJob(null)} onChanged={refresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 140, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.foreground },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.foreground },
  zone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoneText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.foreground },
  count: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  empty: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
});
