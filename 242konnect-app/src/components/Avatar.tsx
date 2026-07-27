import React from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { getCategory, initialsOf, professionalCategory, type Professional } from '../data';
import { colors, fonts, radius } from '../theme';

type Props = {
  professional: Professional;
  size: number;
  /** Corner radius; defaults to a rounded square like the design's cards. */
  rounded?: number;
};

/**
 * A professional's picture, or their initials when there isn't one.
 *
 * Only the four people drawn in the Sleek design have photographs. Rather than
 * borrow a stranger's face for the demo records, the rest get their initials on
 * their category colour — which also makes the list read as a directory instead
 * of a stock-photo grid.
 */
export function ProAvatar({ professional, size, rounded }: Props) {
  const radiusValue = rounded ?? Math.round(size * 0.28);

  if (professional.photo) {
    return (
      <Image
        source={professional.photo}
        style={{ width: size, height: size, borderRadius: radiusValue, borderWidth: 1, borderColor: colors.border }}
      />
    );
  }

  const tint = getCategory(professionalCategory(professional) ?? 'plomberie')?.color ?? colors.secondary;
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radiusValue, backgroundColor: tint },
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.34) }]}>
        {initialsOf(professional.name)}
      </Text>
    </View>
  );
}

/** The signed-in person's own picture, or their initials. */
export function UserAvatar({
  name,
  avatar,
  size,
  border,
}: {
  name: string;
  avatar?: string;
  size: number;
  border?: string;
}) {
  const style = {
    width: size,
    height: size,
    borderRadius: radius.full,
    borderWidth: border ? 2 : 0,
    borderColor: border,
  } as const;

  if (avatar) return <Image source={{ uri: avatar } as ImageSourcePropType} style={style} />;

  return (
    <View style={[styles.fallback, style, { backgroundColor: colors.secondary }]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.heading, color: colors.white },
});
