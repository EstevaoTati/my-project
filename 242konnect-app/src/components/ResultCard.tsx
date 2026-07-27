import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { formatFcfa, type Professional } from '../data';
import { colors, fonts, radius, shadow } from '../theme';

type Props = {
  professional: Professional;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
};

/** The large, image-led card used on the search results screen. */
export function ResultCard({ professional: pro, favorite, onPress, onToggleFavorite }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pro.name}, ${pro.rating} sur 5, ${formatFcfa(pro.hourlyRate)} FCFA par heure`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.media}>
        <Image
          source={pro.photo}
          style={[styles.photo, !pro.verified && styles.photoMuted]}
        />
        <Pressable
          onPress={onToggleFavorite}
          accessibilityRole="button"
          accessibilityLabel={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          hitSlop={8}
          style={styles.favorite}
        >
          <Icon
            name={favorite ? 'solar:heart-bold' : 'solar:heart-linear'}
            size={20}
            color={favorite ? colors.destructive : colors.mutedForeground}
          />
        </Pressable>
        {pro.verified && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedLabel}>Vérifié par 242K</Text>
          </View>
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{pro.name}</Text>
            <View style={styles.ratingRow}>
              <Icon name="solar:star-bold" size={16} color={colors.accent} />
              <Text style={styles.rating}>{pro.rating}</Text>
            </View>
          </View>
          <View style={styles.locationRow}>
            <Icon name="solar:map-point-linear" size={16} color={colors.mutedForeground} />
            <Text style={styles.location}>
              {pro.city} • {pro.distanceKm} km
            </Text>
          </View>
          <View style={styles.tags}>
            {pro.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagLabel}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>
            {formatFcfa(pro.hourlyRate)}
            <Text style={styles.priceUnit}> FCFA/h</Text>
          </Text>
          <Text style={[styles.availability, pro.availableNow && styles.availabilityNow]}>
            {pro.availability}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  pressed: { opacity: 0.9 },
  media: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  photo: { width: '100%', height: '100%' },
  // The design desaturates unverified listings slightly.
  photoMuted: { opacity: 0.85 },
  favorite: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.full,
    ...shadow.sm,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
  },
  verifiedLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.primaryForeground,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.accent },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  location: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
  },
  tagLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.secondaryForeground },
  priceBlock: { alignItems: 'flex-end' },
  price: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.foreground },
  priceUnit: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  availability: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.mutedForeground },
  availabilityNow: { color: colors.primary },
});
