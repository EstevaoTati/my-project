import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { ResultCard } from '../components/ResultCard';
import { getCategory, getTrade, searchProfessionals, type Professional } from '../data';
import { useStore } from '../store';
import type { HomeStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = NativeStackScreenProps<HomeStackParamList, 'Resultats'>;

type SortId = 'pertinence' | 'prix' | 'note' | 'verifie';

const SORTS: { id: SortId; label: string; icon?: 'solar:sort-from-top-to-bottom-bold' }[] = [
  { id: 'pertinence', label: 'Pertinence', icon: 'solar:sort-from-top-to-bottom-bold' },
  { id: 'prix', label: 'Prix' },
  { id: 'note', label: 'Note (4+)' },
  { id: 'verifie', label: 'Vérifié' },
];

/**
 * The design shows these as static pills. They're wired up here because a
 * filter row that doesn't filter is worse than no filter row — a user tapping
 * "Prix" and seeing nothing change reads as a broken app, not as a prototype.
 */
function applySort(list: Professional[], sort: SortId): Professional[] {
  switch (sort) {
    case 'prix':
      return [...list].sort((a, b) => a.hourlyRate - b.hourlyRate);
    case 'note':
      return [...list].filter((p) => p.rating >= 4).sort((a, b) => b.rating - a.rating);
    case 'verifie':
      return list.filter((p) => p.verified);
    case 'pertinence':
    default:
      // Nearest first, which is what "relevance" means for an on-demand trade.
      return [...list].sort((a, b) => a.distanceKm - b.distanceKm);
  }
}

export function SearchResultsScreen({ route, navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { category, tradeId, query } = route.params ?? {};
  const [sort, setSort] = useState<SortId>('pertinence');
  // Favourites are shared with the profile screen so the two hearts agree.
  const { isFavorite, toggleFavorite } = useStore();

  const results = useMemo(
    () => applySort(searchProfessionals({ category, tradeId, query }), sort),
    [category, tradeId, query, sort]
  );

  const title =
    (tradeId && getTrade(tradeId)?.label) ||
    (category && getCategory(category)?.label) ||
    query ||
    'Tous les services';

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('Retour')}
            hitSlop={8}
            style={styles.back}
          >
            <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {results.length} professionnel{results.length === 1 ? '' : 's'} disponible
              {results.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {SORTS.map((option) => {
            const active = sort === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSort(option.id)}
                accessibilityRole="button"
                // Distinguishes the "Vérifié" filter from the "Vérifié par 242K"
                // badge on the cards below, which otherwise reads identically.
                accessibilityLabel={`Trier par ${option.label}`}
                accessibilityState={{ selected: active }}
                style={[styles.sortPill, active ? styles.sortPillActive : styles.sortPillInactive]}
              >
                {option.icon && (
                  <Icon
                    name={option.icon}
                    size={16}
                    color={active ? colors.primaryForeground : colors.foreground}
                  />
                )}
                <Text
                  style={[
                    styles.sortLabel,
                    active ? styles.sortLabelActive : styles.sortLabelInactive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {results.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="solar:magnifer-linear" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>{t('Aucun professionnel trouvé')}</Text>
            <Text style={styles.emptyBody}>
              Essayez une autre catégorie ou retirez le filtre « {SORTS.find((s) => s.id === sort)?.label} ».
            </Text>
          </View>
        ) : (
          results.map((pro) => (
            <ResultCard
              key={pro.id}
              professional={pro}
              favorite={isFavorite(pro.id)}
              onPress={() => navigation.navigate('Profil', { id: pro.id })}
              onToggleFavorite={() => toggleFavorite(pro.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: {
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  titleBlock: { flex: 1 },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground },
  subtitle: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  sortRow: { gap: 8, marginTop: 20, paddingRight: 20 },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  sortPillActive: { backgroundColor: colors.primary },
  sortPillInactive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  sortLabel: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  sortLabelActive: { color: colors.primaryForeground },
  sortLabelInactive: { color: colors.foreground },
  list: { padding: 20, gap: 24 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 64 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
