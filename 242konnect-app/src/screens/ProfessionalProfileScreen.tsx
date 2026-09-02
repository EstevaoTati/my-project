import React, { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { formatFcfa, getProfessional, professionalTrade } from '../data';
import { ProAvatar } from '../components/Avatar';
import { useStore } from '../store';
import type { HomeStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = NativeStackScreenProps<HomeStackParamList, 'Profil'>;

/** Slots offered in the booking sheet; a real build reads these from the pro. */
const SLOTS = ["Aujourd'hui, 14h00", "Aujourd'hui, 16h30", 'Demain, 09h00', 'Demain, 11h00'];

export function ProfessionalProfileScreen({ route, navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const pro = getProfessional(route.params.id);
  const { isFavorite, toggleFavorite, addBooking, ensureThread } = useStore();
  const [showBooking, setShowBooking] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!pro) {
    return (
      <View style={[styles.root, styles.missing]}>
        <Text style={styles.missingText}>{t("Ce professionnel n'est plus disponible.")}</Text>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.missingLink}>{t('Retour')}</Text>
        </Pressable>
      </View>
    );
  }

  const profile = pro.profile;
  const trade = professionalTrade(pro);
  const favorite = isFavorite(pro.id);

  const share = async () => {
    const message = `${pro.name} — ${trade?.label ?? ''}, ${pro.rating}/5 · ${formatFcfa(pro.hourlyRate)} FCFA/h sur 242Konnect`;
    try {
      // Web has no RN Share; use the browser's own sheet, and fall back to the
      // clipboard when the browser doesn't offer one either.
      if (Platform.OS === 'web') {
        const nav = globalThis.navigator as Navigator | undefined;
        if (nav?.share) await nav.share({ title: pro.name, text: message });
        else await nav?.clipboard?.writeText(message);
        return;
      }
      await Share.share({ message });
    } catch {
      // Dismissing the share sheet rejects on some platforms; not an error.
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {pro.photo ? (
            <Image source={pro.photo} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <ProAvatar professional={pro} size={112} rounded={32} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'transparent', colors.background]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroActions, { top: insets.top + 12 }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t('Retour')}
              style={styles.glassButton}
            >
              <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.white} />
            </Pressable>
            <View style={styles.heroActionsRight}>
              <Pressable
                onPress={share}
                accessibilityRole="button"
                accessibilityLabel={t('Partager')}
                style={styles.glassButton}
              >
                <Icon name="solar:share-linear" size={24} color={colors.white} />
              </Pressable>
              <Pressable
                onPress={() => toggleFavorite(pro.id)}
                accessibilityRole="button"
                accessibilityLabel={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                accessibilityState={{ selected: favorite }}
                style={styles.glassButton}
              >
                <Icon
                  name={favorite ? 'solar:heart-bold' : 'solar:heart-linear'}
                  size={24}
                  color={favorite ? colors.destructive : colors.white}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.heroCaption}>
            <View style={styles.heroBadges}>
              {pro.verified && (
                <View style={styles.expertBadge}>
                  <Text style={styles.expertLabel}>{t('Expert Vérifié')}</Text>
                </View>
              )}
              <View style={styles.ratingBadge}>
                <Icon name="solar:star-bold" size={12} color={colors.accentForeground} />
                <Text style={styles.ratingLabel}>{pro.rating}</Text>
              </View>
            </View>
            <Text style={styles.heroName}>{pro.name}</Text>
            <Text style={styles.heroTrade}>{profile?.headline ?? trade?.label ?? ''}</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('Missions')}</Text>
              <Text style={styles.statValue}>{profile?.missions ?? '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('Avis')}</Text>
              <Text style={styles.statValue}>{pro.reviewCount}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('Tarif')}</Text>
              <Text style={[styles.statValue, styles.statValueAccent]}>
                {formatFcfa(pro.hourlyRate)} <Text style={styles.statUnit}>{t('FCFA')}</Text>
              </Text>
            </View>
          </View>

          {profile && (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('À propos')}</Text>
                <Text style={styles.about}>{profile.about}</Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('Compétences')}</Text>
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
                  <Text style={styles.sectionTitle}>{t('Portfolio')}</Text>
                  <Pressable
                    onPress={() => setViewerIndex(0)}
                    accessibilityRole="button"
                    accessibilityLabel={t('Voir tout le portfolio')}
                  >
                    <Text style={styles.sectionAction}>{t('Voir tout')}</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.portfolio}
                >
                  {profile.portfolio.map((image, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setViewerIndex(i)}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={`Photo ${i + 1} sur ${profile.portfolio.length}`}
                    >
                      <Image source={image} style={styles.portfolioImage} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: Math.max(20, insets.bottom) }]}>
        <Pressable
          onPress={() => {
            // Create the thread first, otherwise the Messages tab opens on an
            // empty list and the tap looks like it did nothing.
            ensureThread(pro.id);
            // One getParent(): this screen sits in the Accueil stack, whose
            // parent is the tab navigator. Two hops lands past the root and
            // silently does nothing.
            // `initial: false` keeps Conversations underneath Discussion in the
            // Messages stack. Without it the thread is the only route there, so
            // back pops out of the tab instead of returning to the list.
            navigation.getParent()?.navigate('Messages', {
              screen: 'Discussion',
              params: { id: pro.id },
              initial: false,
            } as never);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Envoyer un message à ${pro.name}`}
          style={styles.messageButton}
        >
          <Icon name="solar:chat-round-dots-bold" size={24} color={colors.secondaryForeground} />
        </Pressable>
        <Pressable
          onPress={() => {
            setConfirmed(false);
            setSlot(null);
            setShowBooking(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Réserver ${pro.name} maintenant`}
          style={styles.bookButton}
        >
          <Text style={styles.bookLabel}>{t('Réserver maintenant')}</Text>
          <Icon name="solar:arrow-right-bold" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <Sheet
        visible={showBooking}
        title={confirmed ? 'Demande envoyée' : `Réserver ${pro.name}`}
        onClose={() => setShowBooking(false)}
      >
        {confirmed ? (
          <View style={styles.confirm}>
            <View style={styles.confirmIcon}>
              <Icon name="solar:shield-check-bold" size={32} color={colors.primary} />
            </View>
            <Text style={styles.confirmTitle}>{t("C'est noté")}</Text>
            <Text style={styles.confirmBody}>
              {pro.name} a reçu votre demande pour {slot?.toLowerCase()}. Retrouvez-la dans
              l'onglet Missions pour la payer ou l'annuler.
            </Text>
            <Pressable
              onPress={() => setShowBooking(false)}
              accessibilityRole="button"
              style={styles.confirmButton}
            >
              <Text style={styles.bookLabel}>{t('Terminé')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sheetHint}>{t('Choisissez un créneau')}</Text>
            {SLOTS.map((option) => {
              const selected = slot === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSlot(option)}
                  accessibilityRole="button"
                  accessibilityLabel={option}
                  accessibilityState={{ selected }}
                  style={[styles.slot, selected && styles.slotSelected]}
                >
                  <Icon
                    name="solar:calendar-mark-linear"
                    size={20}
                    color={selected ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.slotLabel, selected && styles.slotLabelSelected]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('Tarif horaire')}</Text>
              <Text style={styles.totalValue}>{formatFcfa(pro.hourlyRate)} FCFA/h</Text>
            </View>
            <Pressable
              onPress={() => {
              if (slot) addBooking({ professionalId: pro.id, slot, rate: pro.hourlyRate });
              setConfirmed(true);
            }}
              disabled={!slot}
              accessibilityRole="button"
              accessibilityLabel={t('Confirmer la réservation')}
              accessibilityState={{ disabled: !slot }}
              style={[styles.confirmButton, !slot && styles.confirmButtonDisabled]}
            >
              <Text style={styles.bookLabel}>
                {slot ? 'Confirmer la réservation' : 'Choisissez un créneau'}
              </Text>
            </Pressable>
          </>
        )}
      </Sheet>

      <Modal
        visible={viewerIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <Pressable
          style={styles.viewer}
          onPress={() => setViewerIndex(null)}
          accessibilityLabel={t('Fermer la galerie')}
        >
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.viewerScroll}
          >
            {profile?.portfolio.map((image, i) => (
              <Image key={i} source={image} style={styles.viewerImage} resizeMode="contain" />
            ))}
          </ScrollView>
        </Pressable>
      </Modal>
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
  heroFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
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
  sheetHint: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, marginBottom: 12 },
  slot: {
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
  slotSelected: { borderColor: colors.primary, backgroundColor: colors.muted },
  slotLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  slotLabelSelected: { fontFamily: fonts.sansSemibold },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  totalValue: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.foreground },
  confirmButton: {
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  confirmButtonDisabled: { backgroundColor: colors.mutedForeground, opacity: 0.5 },
  confirm: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  confirmTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground },
  confirmBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 8,
  },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerScroll: { alignItems: 'center' },
  viewerImage: { width: 360, height: 480, marginHorizontal: 12 },
});
