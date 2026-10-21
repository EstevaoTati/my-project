import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth';
import { getTrade } from '../../data';
import { listListings, marketplaceEnabled, type Listing } from '../../marketplace';
import { describePricing } from '../../pricing';
import { colors, fonts, radius } from '../../theme';
import { useT } from '../../i18n';
import { useMarketData } from './shared';

/**
 * Prestataires who signed up on 242Konnect, from the server.
 *
 * Shown apart from the catalogue above it on purpose: those are design
 * records, these are people. Pending profiles are listed with their badge
 * (Prestataire §07: "visible avec un badge explicite") and cannot be booked.
 * Client §11: results respect the country — a listing from another country is
 * not offered.
 */
export function DirectorySection({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { account } = useAuth();
  const { data, error } = useMarketData(listListings, 30000);
  if (!marketplaceEnabled || !account) return null;

  const country = account.location.country === 'US' ? 'US' : 'CG';
  const listings = (data ?? []).filter(
    (l: Listing) => l.id !== account.supabaseUserId && l.country === country
  );

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('Prestataires inscrits')}</Text>
      {!!error && <Text style={styles.empty}>{error}</Text>}
      {data && listings.length === 0 && (
        <Text style={styles.empty}>{t('Aucun prestataire inscrit dans votre pays pour le moment.')}</Text>
      )}
      {listings.map((l) => {
        const approved = l.status === 'approved';
        return (
          <Pressable
            key={l.id}
            onPress={() => onOpen(l.id)}
            accessibilityRole="button"
            accessibilityLabel={`${t('Prestataire inscrit')} ${l.fullName}`}
            style={styles.card}
          >
            <View style={styles.body}>
              <Text style={styles.name}>{l.fullName}</Text>
              <Text style={styles.sub}>
                {t(getTrade(l.tradeId)?.label ?? l.tradeId)} · {l.zone || l.city}
              </Text>
              <Text style={styles.sub}>{describePricing(l.pricing, t)}</Text>
            </View>
            <View style={[styles.badge, approved ? styles.badgeOn : styles.badgeOff]}>
              <Text style={[styles.badgeText, approved ? styles.badgeTextOn : styles.badgeTextOff]}>
                {approved ? t('Vérifié') : t('En examen · non réservable')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, marginTop: 24 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  empty: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
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
