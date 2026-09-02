import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import type { Category } from '../data';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = {
  category: Category;
  onPress: () => void;
  /** Selected chips fill with the brand yellow — the charte's only accent. */
  selected?: boolean;
};

export function CategoryChip({ category, onPress, selected }: Props) {
  const t = useT();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Catégorie ${t(category.label)}`}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View style={[styles.tile, selected && styles.tileSelected]}>
        <Icon name={category.icon} size={30} color={colors.foreground} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {t(category.label)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, minWidth: 72 },
  // The web design tints the tile on hover; touch has no hover, so a press
  // dim stands in as the equivalent affordance.
  pressed: { opacity: 0.6 },
  tile: {
    width: 64,
    height: 64,
    borderRadius: radius['2xl'],
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  tileSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  label: {
    fontFamily: fonts.sansSemibold,
    fontSize: 12,
    textAlign: 'center',
    color: colors.foreground,
  },
});
