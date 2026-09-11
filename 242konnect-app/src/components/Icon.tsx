import React from 'react';
import { SvgXml } from 'react-native-svg';
import { ICONS, type IconName } from '../icons';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

/**
 * Renders one of the design's Iconify icons.
 *
 * The bundled SVGs use `currentColor` and `1em` sizing, which SvgXml resolves
 * from the `color`/`width`/`height` overrides below — so a single source SVG
 * serves every size and tint the design asks for, exactly as it does on web.
 */
export function Icon({ name, size = 24, color }: Props) {
  return (
    <SvgXml
      xml={ICONS[name]}
      width={size}
      height={size}
      color={color}
      // Icons here are decorative; the surrounding pressable carries the label.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
