import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { formatFcfa, getProfessional } from '../data';
import type { HomeStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<HomeStackParamList, 'Profil'>;

export function ProfessionalProfileScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const pro = getProfessional(route.params.id);

  if (!pro) {
    return (
      <View style={[styles.root, styles.missing]}>
        <Text style={styles.missingText}>Ce professionnel n'est plus disponible.</Text>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.missingLink}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const profile = pro.profile;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Image source={pro.photo} style={styles.heroImage} />
          <LinearGradient
            colors={['transparent', 'transparent', colors.background]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroActions, { top: insets.top + 12 }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Retour"
              style={styles.glassButton}
            >
              <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.white} />
            </Pressable>
            <View style={styles.heroActionsRight}>
              <Pressable accessibilityRole="button" accessibilityLabel="Partager" style={styles.glassButton}>
                <Icon name="solar:share-linear" size={24} color={colors.white} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ajouter aux favoris"
                style={styles.glassButton}
              >
                <Icon name="solar:heart-linear" size={24} color={colors.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroCaption}>
            <View style={styles.heroBadges}>
              {pro.verified && (
                <View style={styles.expertBadge}>
                  <Text style={styles.expertLabel}>Expert Vérifié</Text>
                </View>
              )}
              <View style={styles.ratingBadge}>
                <Icon name="solar:star-bold" size={12} color={colors.accentForeground} />
                <Text style={styles.ratingLabel}>{pro.rating}</Text>
              </View>
            </View>
            <Text style={styles.heroName}>{pro.name}</Text>
            <Text style={styles.heroTrade}>{profile?.headline ?? pro.trade}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Missions</Text>
              <Text style={styles.statValue}>{profile?.missions ?? '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Avis</Text>
              <Text style={styles.statValue}>{pro.reviewCount}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Tarif</Text>
              <Text style={[styles.statValue, styles.statValueAccent]}>
                {formatFcfa(pro.hourlyRate)} <Text style={styles.statUnit}>FCFA</Text>
              </Text>
            </View>
          </View>

          {profile && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>À propos</Text>
                <Text style={styles.about}>{profile.about}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Compétences</Text>
                <View style={styles.skills}>
                  {profile.skills.map((skill) => (
                    <View key={skill} style={styles.skill}>
                      <Text style={styles.skillLabel}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Portfolio</Text>
                  <Pressable accessibilityRole="button">
                    <Text style={styles.sectionAction}>Voir tout</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.portfolio}
                >
                  {profile.portfolio.map((image, i) => (
                    <Image key={i} source={image} style={styles.portfolioImage} />
                  ))}
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: Math.max(20, insets.bottom) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Envoyer un message" style={styles.messageButton}>
          <Icon name="solar:chat-round-dots-bold" size={24} color={colors.secondaryForeground} />
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.bookButton}>
          <Text style={styles.bookLabel}>Réserver maintenant</Text>
          <Icon name="solar:arrow-right-bold" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  missing: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingText: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.mutedForeground },
  missingLink: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.primary },
  scroll: {},
  hero: { height: 288 },
  heroImage: { width: '100%', height: '100%' },
  heroActions: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroActionsRight: { flexDirection: 'row', gap: 8 },
  glassButton: {
    padding: 10,
    borderRadius: radius['2xl'],
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroCaption: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  expertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  expertLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.primaryForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
  },
  ratingLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.accentForeground },
  heroName: { fontFamily: fonts.heading, fontSize: 30, color: colors.foreground },
  heroTrade: { fontFamily: fonts.sansMedium, fontSize: 14, color: 'rgba(15,23,42,0.8)' },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    marginBottom: 24,
    ...shadow.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  statLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginBottom: 4 },
  statValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.foreground },
  statValueAccent: { color: colors.primary },
  statUnit: { fontSize: 12 },
  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground, marginBottom: 12 },
  sectionAction: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.primary, marginBottom: 12 },
  about: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, color: colors.mutedForeground },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.secondary,
    borderRadius: radius.xl,
  },
  skillLabel: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.secondaryForeground },
  portfolio: { gap: 12 },
  portfolioImage: {
    width: 192,
    height: 128,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  messageButton: {
    padding: 16,
    backgroundColor: colors.secondary,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  bookButton: {
    flex: 1,
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: radius['2xl'],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.primaryGlow,
  },
  bookLabel: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.primaryForeground },
});
