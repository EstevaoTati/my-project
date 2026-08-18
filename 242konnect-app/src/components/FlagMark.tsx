import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors, radius } from '../theme';
import { View, StyleSheet } from 'react-native';

/**
 * The flag of the Republic of the Congo.
 *
 * Three fields split by two parallel diagonals running from the lower hoist to
 * the upper fly — not horizontal stripes, which is what this component replaced.
 *
 * The geometry is measured from the reference image rather than eyeballed: the
 * green/yellow boundary meets the top edge at exactly 2/3 of the width and the
 * bottom-left corner; the yellow/red boundary meets the top-right corner and
 * the bottom edge at 1/3. In a 3×2 viewBox that lands on whole numbers, which
 * is why the flag is drawn in those units.
 *
 * Ratio is 3:2. Passing a width alone keeps it correct; passing both is how you
 * get a squashed flag, so height is derived here instead.
 */

type Props = {
  /** Width in points. Height follows the 3:2 ratio. */
  width: number;
  /** Rounds the corners, for use as a small brand mark. */
  rounded?: boolean;
};

export function FlagMark({ width, rounded }: Props) {
  const height = (width * 2) / 3;
  return (
    <View
      style={[
        { width, height, overflow: 'hidden' },
        rounded && { borderRadius: Math.max(3, Math.round(width * 0.1)) },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height} viewBox="0 0 3 2">
        {/* Green: upper hoist triangle. */}
        <Path d="M0,0 H2 L0,2 Z" fill={colors.logoGreen} />
        {/* Yellow: the band between the two parallel diagonals. */}
        <Path d="M2,0 H3 L1,2 H0 Z" fill={colors.logoYellow} />
        {/* Red: lower fly triangle. */}
        <Path d="M3,0 V2 H1 Z" fill={colors.logoRed} />
      </Svg>
    </View>
  );
}

/** Kept so callers can rely on the ratio without recomputing it. */
export const FLAG_RATIO = 3 / 2;

const styles = StyleSheet.create({});
