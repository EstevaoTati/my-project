import React, { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { CategoryChip } from '../components/CategoryChip';
import { ProCard } from '../components/ProCard';
import { Sheet } from '../components/Sheet';
import { categories, promo, topProfessionals } from '../data';
import { useAuth } from '../auth';
import { CITIES, useStore, type City } from '../store';
import type { HomeStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Accueil'>;

/** Stand-in feed until there's a backend pushing real events. */
const NOTIFICATIONS = [
  {
    id: '1',
    title: 'Jean-Paul K. a accepté votre demande',
    body: "Intervention prévue aujourd'hui à 14h.",
    unread: true,
  },
  {
    id: '2',
    title: 'Nouveau professionnel vérifié',
    body: 'Un électricien vérifié vient de rejoindre votre quartier.',
    unread: true,
  },
  {
    id: '3',
    title: 'Notez votre dernière mission',
    body: 'Votre avis aide les autres clients à choisir.',
    unread: false,
  },
];

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const { city, setCity } = useStore();
  const { account } = useAuth();
  const [readIds, setReadIds] = useState<string[]>([]);
  const initials = (account?.name ?? '')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const unreadCount = NOTIFICATIONS.filter((n) => n.unread && !readIds.includes(n.id)).length;

  const openNotifications = () => {
    setShowNotifications(true);
    // Opening the panel is what "seeing" them means, so the dot clears here.
    setReadIds(NOTIFICATIONS.map((n) => n.id));
  };

  const submitSearch = () => {
    const trimmed = query.trim();
    navigation.navigate('Resultats', trimmed ? { query: trimmed } : {});
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={styles.identity}>
            <View>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.presenceDot} />
            </View>
            <View>
              <Text style={styles.greeting}>Bienvenue,</Text>
              <Text style={styles.name}>{account?.name ?? ''}</Text>
            </View>
          </View>
          <Pressable
            onPress={openNotifications}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'
            }
            style={styles.bell}
          >
            <Icon name="solar:bell-bing-bold-duotone" size={24} color={colors.foreground} />
            {unreadCount > 0 && <View style={styles.bellDot} />}
          </Pressable>
        </View>

        <Pressable
          onPress={() => setShowCities(true)}
          accessibilityRole="button"
          accessibilityLabel={`Localisation : ${city}. Changer de ville`}
          style={styles.locationRow}
        >
          <Icon name="solar:map-point-bold" size={20} color={colors.primary} />
          <Text style={styles.locationText}>{city}</Text>
          <Icon name="solar:alt-arrow-down-linear" size={16} color={colors.mutedForeground} />
        </Pressable>

        <View style={styles.searchWrap}>
          <View style={styles.searchIcon}>
            <Icon name="solar:magnifer-linear" size={20} color={colors.mutedForeground} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            placeholder="Quel service recherchez-vous ?"
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel="Quel service recherchez-vous ?"
            style={styles.searchInput}
          />
          <Pressable
            onPress={submitSearch}
            accessibilityRole="button"
            accessibilityLabel="Rechercher"
            style={styles.searchButton}
          >
            <Icon name="solar:tuning-square-2-bold" size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.promo}>
          <Image source={promo.image} style={styles.promoImage} />
          <LinearGradient
            // Matches the export's `from-secondary/90 to-secondary/30`.
            colors={['rgba(30,41,59,0.9)', 'rgba(30,41,59,0.3)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.promoBody}>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeLabel}>{promo.badge}</Text>
            </View>
            <Text style={styles.promoTitle}>{promo.title}</Text>
            <Text style={styles.promoSubtitle}>{promo.subtitle}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Catégories</Text>
          <Pressable onPress={() => navigation.navigate('Resultats', {})} accessibilityRole="button">
            <Text style={styles.sectionAction}>Voir tout</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((category) => (
            <CategoryChip
              key={category.id}
              category={category}
              onPress={() => navigation.navigate('Resultats', { category: category.id })}
            />
          ))}
        </ScrollView>

        <View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>
          <Text style={styles.sectionTitle}>Top Professionnels</Text>
          <Pressable onPress={() => navigation.navigate('Resultats', {})} accessibilityRole="button">
            <Text style={styles.sectionAction}>Voir plus</Text>
          </Pressable>
        </View>
        <View style={styles.proList}>
          {topProfessionals.map((pro) => (
            <ProCard
              key={pro.id}
              professional={pro}
              onPress={() => navigation.navigate('Profil', { id: pro.id })}
            />
          ))}
        </View>
      </ScrollView>

      <Sheet
        visible={showNotifications}
        title="Notifications"
        onClose={() => setShowNotifications(false)}
      >
        {NOTIFICATIONS.map((item) => (
          <View key={item.id} style={styles.notification}>
            <View style={styles.notificationIcon}>
              <Icon name="solar:bell-bing-bold-duotone" size={20} color={colors.primary} />
            </View>
            <View style={styles.notificationBody}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationText}>{item.body}</Text>
            </View>
          </View>
        ))}
      </Sheet>

      <Sheet visible={showCities} title="Votre ville" onClose={() => setShowCities(false)}>
        {CITIES.map((option) => {
          const selected = option === city;
          return (
            <Pressable
              key={option}
              onPress={() => {
                setCity(option as City);
                setShowCities(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={option}
              accessibilityState={{ selected }}
              style={[styles.cityRow, selected && styles.cityRowSelected]}
            >
              <Icon
                name="solar:map-point-bold"
                size={20}
                color={selected ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.cityLabel, selected && styles.cityLabelSelected]}>{option}</Text>
              {selected && <Icon name="solar:shield-check-bold" size={20} color={colors.primary} />}
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 16, color: colors.white },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  greeting: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  name: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  bell: {
    padding: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.destructive,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  locationText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.mutedForeground },
  searchWrap: { marginTop: 20, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 16, zIndex: 1 },
  searchInput: {
    height: 56,
    paddingLeft: 48,
    paddingRight: 56,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
    ...shadow.sm,
  },
  searchButton: {
    position: 'absolute',
    right: 8,
    padding: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    ...shadow.sm,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  promo: {
    marginHorizontal: 20,
    marginTop: 8,
    height: 160,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    ...shadow.sm,
  },
  promoImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  promoBody: { flex: 1, padding: 20, justifyContent: 'center' },
  promoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    marginBottom: 8,
  },
  promoBadgeLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentForeground },
  promoTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.white, width: '70%' },
  promoSubtitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  sectionHeader: {
    marginTop: 32,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderSpaced: { marginTop: 16 },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  sectionAction: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.primary },
  categoryRow: { paddingHorizontal: 20, gap: 16, paddingBottom: 16 },
  proList: { paddingHorizontal: 20, gap: 16 },
  notification: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: { flex: 1 },
  notificationTitle: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  notificationText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  cityRowSelected: { borderColor: colors.primary, backgroundColor: colors.muted },
  cityLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  cityLabelSelected: { fontFamily: fonts.sansSemibold },
});
