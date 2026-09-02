import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import {
  categories,
  formatFcfa,
  getCategory,
  searchProfessionals,
  searchTrades,
  type CategoryId,
} from '../data';
import type { HomeStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = NativeStackScreenProps<HomeStackParamList, 'Metiers'>;

/**
 * The full trades catalogue.
 *
 * The home screen only has room for a strip of categories, which hides most of
 * what the marketplace actually covers. This is the browsable version: every
 * trade with what it includes and what it costs, filterable by category or by
 * typing what you need in your own words.
 */
export function TradesScreen({ navigation, route }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState<CategoryId | undefined>(route.params?.category);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const found = searchTrades(query);
    return active ? found.filter((t) => t.category === active) : found;
  }, [query, active]);

  const grouped = useMemo(() => {
    const map = new Map<CategoryId, typeof results>();
    for (const trade of results) {
      const list = map.get(trade.category) ?? [];
      list.push(trade);
      map.set(trade.category, list);
    }
    return [...map.entries()];
  }, [results]);

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
            <Text style={styles.title}>{t('Tous les métiers')}</Text>
            <Text style={styles.subtitle}>
              {results.length} métier{results.length > 1 ? 's' : ''} dans {categories.length} catégories
            </Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchIcon}>
            <Icon name="solar:magnifer-linear" size={20} color={colors.mutedForeground} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('Décrivez votre besoin')}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t('Rechercher un métier')}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Pressable
            onPress={() => setActive(undefined)}
            accessibilityRole="button"
            accessibilityLabel={t('Toutes les catégories')}
            accessibilityState={{ selected: !active }}
            style={[styles.chip, !active && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, !active && styles.chipLabelActive]}>{t('Tout')}</Text>
          </Pressable>
          {categories.map((category) => {
            const selected = active === category.id;
            return (
              <Pressable
                key={category.id}
                onPress={() => setActive(selected ? undefined : category.id)}
                accessibilityRole="button"
                accessibilityLabel={`Catégorie ${t(category.label)}`}
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Icon name={category.icon} size={16} color={colors.foreground} />
                <Text style={styles.chipLabel}>{t(category.label)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {grouped.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('Aucun métier trouvé')}</Text>
            <Text style={styles.emptyBody}>{t('Essayez un autre mot, par exemple « fuite » ou « clim ».')}</Text>
          </View>
        )}

        {grouped.map(([categoryId, list]) => {
          const category = getCategory(categoryId);
          if (!category) return null;
          return (
            <View key={categoryId} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.groupDot} />
                <Text style={styles.groupTitle}>{t(category.label)}</Text>
              </View>
              <Text style={styles.groupBlurb}>{t(category.blurb)}</Text>

              {list.map((trade) => {
                const count = searchProfessionals({ tradeId: trade.id }).length;
                return (
                  <Pressable
                    key={trade.id}
                    onPress={() => navigation.navigate('Resultats', { tradeId: trade.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${t(trade.label)}, ${count} professionnel${count > 1 ? 's' : ''}`}
                    style={({ pressed }) => [styles.trade, pressed && styles.pressed]}
                  >
                    <View style={styles.tradeTop}>
                      <Text style={styles.tradeLabel}>{t(trade.label)}</Text>
                      <Text style={styles.tradeRate}>
                        {formatFcfa(trade.minRate)}–{formatFcfa(trade.maxRate)} FCFA/h
                      </Text>
                    </View>
                    <Text style={styles.tradeDesc}>{t(trade.description)}</Text>
                    <View style={styles.tradeFoot}>
                      <Text style={styles.tradeCount}>
                        {count} professionnel{count > 1 ? 's' : ''}
                      </Text>
                      <Icon name="solar:arrow-right-bold" size={16} color={colors.primary} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
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
  searchWrap: { marginTop: 16, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 14, zIndex: 1 },
  searchInput: {
    height: 48,
    paddingLeft: 44,
    paddingRight: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
  },
  chips: { gap: 8, marginTop: 12, paddingRight: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  chipLabelActive: { color: colors.accentForeground },
  list: { padding: 20, gap: 24 },
  group: { gap: 8 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  groupTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  groupBlurb: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginBottom: 4 },
  trade: {
    padding: 14,
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  pressed: { opacity: 0.85 },
  tradeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tradeLabel: { flex: 1, fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  tradeRate: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.primary },
  tradeDesc: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  tradeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tradeCount: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.mutedForeground },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 48 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  emptyBody: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
});
