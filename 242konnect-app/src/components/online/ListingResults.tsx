import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../Icon';
import { sameCity } from '../../area';
import { getCategory, getTrade, type CategoryId } from '../../data/trades';
import { colors, fonts, radius, shadow } from '../../theme';
import { T, useT } from '../../i18n';
import { byPrice, filterDirectory, ListingCard, useDirectory } from './Directory';

type SortId = 'pertinence' | 'prix' | 'ville';

const SORTS: { id: SortId; label: string }[] = [
  { id: 'pertinence', label: T('Pertinence') },
  { id: 'prix', label: T('Prix') },
  { id: 'ville', label: T('Dans ma ville') },
];

/**
 * A category, a trade or a search, answered with the real directory: approved
 * prestataires of the client's country, the chosen city first.
 */
export function ListingResults({
  category,
  tradeId,
  query,
  onBack,
  onOpen,
}: {
  category?: CategoryId;
  tradeId?: string;
  query?: string;
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { listings, loaded, error, area, label } = useDirectory();
  const [sort, setSort] = useState<SortId>('pertinence');

  const results = useMemo(() => {
    const found = filterDirectory(listings, { category, tradeId, query }, t);
    if (sort === 'prix') return [...found].sort(byPrice);
    if (sort === 'ville') return found.filter((l) => sameCity(l.city, area.city));
    return found;
  }, [listings, category, tradeId, query, sort, area.city, t]);

  const tradeLabel = tradeId ? getTrade(tradeId)?.label : undefined;
  const categoryLabel = category ? getCategory(category)?.label : undefined;
  const title = tradeLabel ? t(tradeLabel) : categoryLabel ? t(categoryLabel) : query || t('Tous les services');

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.titleRow}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('Retour')} hitSlop={8} style={styles.back}>
            <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {results.length === 1 ? t('1 prestataire vérifié') : t('{n} prestataires vérifiés', { n: results.length })} · {label}
            </Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORTS.map((option) => {
            const active = sort === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setSort(option.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t('Trier par')} ${t(option.label)}`}
                aria-selected={active}
                style={[styles.pill, active ? styles.pillOn : styles.pillOff]}
              >
                <Text style={[styles.pillLabel, active && styles.pillLabelOn]}>{t(option.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {!!error && <Text style={styles.emptyBody}>{error}</Text>}
        {!loaded && !error && <Text style={styles.emptyBody}>{t('Chargement…')}</Text>}
        {loaded && results.length === 0 && (
          <View style={styles.empty}>
            <Icon name="solar:magnifer-linear" size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyTitle}>{t('Aucun prestataire trouvé')}</Text>
            <Text style={styles.emptyBody}>
              {sort === 'ville'
                ? t('Personne dans votre ville pour le moment. Affichez tout le pays avec « Pertinence ».')
                : t('Personne ne propose encore ce service dans votre pays. Publiez une demande avec le bouton + : elle sera envoyée aux prestataires concernés.')}
            </Text>
          </View>
        )}
        {results.map((l) => (
          <ListingCard key={l.id} listing={l} onOpen={() => onOpen(l.id)} nearby={sameCity(l.city, area.city)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  back: { padding: 8, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, ...shadow.sm },
  titleBlock: { flex: 1 },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground },
  subtitle: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  sortRow: { gap: 8, paddingTop: 16 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1 },
  pillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillOff: { backgroundColor: colors.card, borderColor: colors.border },
  pillLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  pillLabelOn: { color: colors.primaryForeground },
  list: { padding: 20, gap: 10, paddingBottom: 140 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  emptyBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground, textAlign: 'center' },
});
