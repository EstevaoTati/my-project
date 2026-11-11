import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth';
import { sameCity, tidyCity, useArea } from '../../area';
import { getTrade, type CategoryId } from '../../data/trades';
import { listListings, marketplaceEnabled, type Listing } from '../../marketplace';
import { bookableAmount, describePricing } from '../../pricing';
import type { SupabaseSession } from '../../supabase';
import { colors, fonts, radius } from '../../theme';
import { useT } from '../../i18n';
import { useMarketData } from './shared';

/**
 * The prestataires a client can actually reach: people who signed up on
 * 242Konnect, were approved, and work in the client's own country.
 *
 * When the server is there, this is the catalogue — home, categories, search.
 * The design's sample professionals are kept only for builds with no server:
 * showing a tester in Utah five invented tradespeople from Pointe-Noire, none
 * of whom can be contacted, is what the first field test ran into.
 */
export function useDirectory() {
  const { account } = useAuth();
  const country = account?.location.country === 'US' ? 'US' : 'CG';
  const load = useCallback((session: SupabaseSession) => listListings(session, country), [country]);
  const { data, error } = useMarketData(load, 30000);

  const inCountry = useMemo(
    () => (data ?? []).filter((l) => l.country === country && l.id !== account?.supabaseUserId),
    [data, country, account?.supabaseUserId]
  );
  const cities = useMemo(() => [...new Set(inCountry.map((l) => tidyCity(l.city)).filter(Boolean))], [inCountry]);
  const areaState = useArea(cities);
  const city = areaState.area.city;

  // The chosen city first, then the rest of the country; approved before pending.
  const listings = useMemo(
    () =>
      [...inCountry].sort(
        (a, b) =>
          Number(sameCity(b.city, city)) - Number(sameCity(a.city, city)) ||
          Number(b.status === 'approved') - Number(a.status === 'approved')
      ),
    [inCountry, city]
  );

  return { ...areaState, listings, loaded: data !== null, error, country };
}

export function filterDirectory(
  listings: Listing[],
  opts: { category?: CategoryId; tradeId?: string; query?: string },
  t: (s: string) => string
): Listing[] {
  const query = opts.query?.trim().toLowerCase();
  return listings.filter((l) => {
    const trade = getTrade(l.tradeId);
    if (opts.tradeId && l.tradeId !== opts.tradeId) return false;
    if (opts.category && trade?.category !== opts.category) return false;
    if (!query) return true;
    // Both languages: someone may search "plumber" on a French screen.
    const haystack = [l.fullName, trade?.label ?? l.tradeId, trade ? t(trade.label) : '', trade?.description ?? '', trade ? t(trade.description) : '', l.zone, l.city, l.bio]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Lowest first; "sur devis" has no figure and goes last. */
export function byPrice(a: Listing, b: Listing): number {
  return (bookableAmount(a.pricing) || Infinity) - (bookableAmount(b.pricing) || Infinity);
}

export function ListingCard({ listing, onOpen, nearby }: { listing: Listing; onOpen: () => void; nearby: boolean }) {
  const t = useT();
  const approved = listing.status === 'approved';
  const trade = getTrade(listing.tradeId);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${t('Prestataire inscrit')} ${listing.fullName}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.initials}>
        <Text style={styles.initialsText}>{(listing.fullName.trim()[0] ?? '?').toUpperCase()}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {listing.fullName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {t(trade?.label ?? listing.tradeId)} · {tidyCity(listing.city)}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {describePricing(listing.pricing, t)}
          {nearby ? ` · ${t('Dans votre ville')}` : ''}
        </Text>
      </View>
      <View style={[styles.badge, approved ? styles.badgeOn : styles.badgeOff]}>
        <Text style={[styles.badgeText, approved ? styles.badgeTextOn : styles.badgeTextOff]}>
          {approved ? t('Vérifié') : t('En examen · non réservable')}
        </Text>
      </View>
    </Pressable>
  );
}

/** Home: the first prestataires of the area, with the way to all of them. */
export function DirectorySection({
  directory,
  onOpen,
  onSeeAll,
  limit = 5,
}: {
  directory: ReturnType<typeof useDirectory>;
  onOpen: (id: string) => void;
  onSeeAll: () => void;
  limit?: number;
}) {
  const t = useT();
  const { listings, loaded, error, area, label } = directory;
  if (!marketplaceEnabled) return null;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('Prestataires près de vous')}</Text>
        {listings.length > limit && (
          <Pressable onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={t('Voir tous les prestataires')}>
            <Text style={styles.action}>{t('Voir plus')}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.where}>{label}</Text>
      {!!error && <Text style={styles.empty}>{error}</Text>}
      {loaded && listings.length === 0 && (
        <Text style={styles.empty}>
          {t('Aucun prestataire vérifié dans votre pays pour le moment. Publiez une demande avec le bouton + : elle sera envoyée aux prestataires dès leur arrivée.')}
        </Text>
      )}
      {listings.slice(0, limit).map((l) => (
        <ListingCard key={l.id} listing={l} onOpen={() => onOpen(l.id)} nearby={sameCity(l.city, area.city)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 24, paddingHorizontal: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  action: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primary },
  where: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground, marginTop: -6 },
  empty: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.85 },
  initials: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.foreground },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  sub: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.lg },
  badgeOn: { backgroundColor: colors.successSurface },
  badgeOff: { backgroundColor: colors.warningSurface },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 11 },
  badgeTextOn: { color: colors.success },
  badgeTextOff: { color: colors.warning },
});
