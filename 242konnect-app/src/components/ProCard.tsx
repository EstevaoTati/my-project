import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { formatFcfa, professionalTrade, type Professional } from '../data';
import { ProAvatar } from './Avatar';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = {
  professional: Professional;
  onPress: () => void;
};

/** The compact "Top Professionnels" card on the home screen. */
export function ProCard({ professional: pro, onPress }: Props) {
  const t = useT();
  const trade = professionalTrade(pro);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${pro.name}, ${trade?.label ?? ''}, ${pro.rating} sur 5`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {pro.verified && (
        <View style={styles.verifiedCorner}>
          <Icon name="solar:shield-check-bold" size={20} color={colors.accent} />
        </View>
      )}
      <ProAvatar professional={pro} size={80} />
      <View style={styles.body}>
        <View style={styles.ratingRow}>
          <Icon name="solar:star-bold" size={16} color={colors.accent} />
          <Text style={styles.rating}>{pro.rating}</Text>
          <Text style={styles.reviews}>({pro.reviewCount} avis)</Text>
        </View>
        <Text style={styles.name}>{pro.name}</Text>
        <Text style={styles.trade}>{trade?.label ?? ''}</Text>
        <View style={styles.footer}>
          <Text style={styles.price}>
            {formatFcfa(pro.hourlyRate)} FCFA
            <Text style={styles.priceUnit}>{t('/h')}</Text>
          </Text>
          {/* Visual affordance only: the whole card is the touch target, so a
              nested pressable here would just compete with it. */}
          <View style={styles.cta}>
            <Text style={styles.ctaLabel}>{t('Réserver')}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    overflow: 'hidden',
    ...shadow.sm,
  },
  pressed: { opacity: 0.85 },
  verifiedCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255, 203, 5, 0.2)',
    borderBottomLeftRadius: radius['3xl'],
    alignItems: 'flex-end',
    padding: 8,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  rating: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.accent },
  reviews: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  name: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  trade: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.mutedForeground,
    marginBottom: 8,
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  priceUnit: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  cta: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.secondary,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.secondaryForeground },
});
