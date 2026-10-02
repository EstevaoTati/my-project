import React from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Mask, Polygon, Rect } from 'react-native-svg';
import { colors } from '../theme';

/**
 * The official 242Konnect mark: two interlocking chain links in the national
 * colours, from the brand file the founder supplied.
 *
 * Drawn rather than shipped as a bitmap. The source was a 1254×1254 PNG on a
 * photographic ground — 2.2 MB, fixed resolution, and carrying a background
 * that would fight every surface it sat on. As geometry it costs nothing, stays
 * sharp at any size, and sits on light or dark alike.
 *
 * Every number below was measured off that file, not eyeballed. Coordinates are
 * the brand file's own, shifted so the mark starts at the origin:
 *
 *   mark            787 × 288, so 2.73 : 1
 *   band            73 thick
 *   green link      x 0 → 469
 *   red link        x 306 → 787
 *   colours         #029b4f, #fbd218, #e4181f
 *
 * Two things make it read as a chain rather than as two overlapping rings, and
 * both are easy to get wrong:
 *
 * **The links alternate.** Green passes over red above the centre line and
 * under it below. A consistent z-order looks like one ring resting on another;
 * only the alternation reads as links. Each ring is therefore masked by a
 * knockout traced along the other, clipped to the half where it goes behind —
 * which also produces the dark gap the original has between them.
 *
 * **The colour cuts are diagonal, and each link has its own.** Yellow is not
 * the geometric intersection of the two bands — painting that gives small
 * lozenges where they cross and loses the S-curve entirely. Green turns yellow
 * past the 45° line x+y = 444; red is yellow until x+y = 620. Both are further
 * clipped to the overlap so the outer straight bands keep their colour, which
 * is what leaves each interlocking cap fully yellow.
 */

const VB_W = 787;
const VB_H = 288;
const BAND = 73;
const INSET = BAND / 2;

/**
 * Centreline of each ring: the stroke straddles it, half in and half out, so
 * the rect is the outer box inset by half the band on every side.
 *
 * The cap centres are what set the interlock, and they fall `rx` inside each
 * end of the rect — green at 325, red at 450, the 125 apart the brand file
 * has. Worth stating because it is easy to "fix" this by insetting the rect by
 * the full cap radius instead, which collapses both links into squares.
 */
const RING_Y = INSET;
const RING_H = VB_H - BAND;
const RING_RY = RING_H / 2;

const GREEN_X = INSET;
const GREEN_W = 469 - BAND;
const RED_X = 306 + INSET;
const RED_W = VB_W - 306 - BAND;

/** The knockout is the band plus a gap either side, so the links do not touch. */
const GAP = 34;
const KNOCKOUT = BAND + GAP;

export const LOGO_RATIO = VB_W / VB_H;

type RingProps = { stroke: string; x: number; width: number; strokeWidth?: number };

/** One link: a fully rounded rect, stroked and unfilled. */
const Ring = ({ stroke, x, width, strokeWidth = BAND }: RingProps) => (
  <Rect
    x={x}
    y={RING_Y}
    width={width}
    height={RING_H}
    rx={RING_RY}
    ry={RING_RY}
    fill="none"
    stroke={stroke}
    strokeWidth={strokeWidth}
  />
);

type Props = {
  /** Width in points. Height follows the mark's own 2.73:1 ratio. */
  width: number;
  /** Accessible name. Omit on decorative uses beside the wordmark. */
  label?: string;
};

export function Logo({ width, label }: Props) {
  const height = width / LOGO_RATIO;
  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      };

  return (
    <View style={{ width, height }} {...a11y}>
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <Defs>
          <ClipPath id="topHalf">
            <Rect x="0" y="0" width={VB_W} height={VB_H / 2} />
          </ClipPath>
          <ClipPath id="bottomHalf">
            <Rect x="0" y={VB_H / 2} width={VB_W} height={VB_H / 2} />
          </ClipPath>

          {/* Each link turns yellow at its own 45° cut, and only inside the
              overlap, so the outer straight bands keep their colour. Green
              turns yellow after x+y = 444; red is yellow until x+y = 620. */}
          <ClipPath id="greenCut">
            <Polygon points={`444,0 ${VB_W},0 ${VB_W},${VB_H} 306,${VB_H} 306,138`} />
          </ClipPath>
          <ClipPath id="redCut">
            <Polygon points={`0,0 469,0 469,151 332,${VB_H} 0,${VB_H}`} />
          </ClipPath>

          {/* Both masks declare an explicit user-space region. Without it they
              default to the object's bounding box inset to 90%, which quietly
              clips the outer tenth of every stroke: the bands render thin and
              the mark stops touching its own edges. */}
          {/* Green is hidden where red crosses it, below the centre line. */}
          <Mask id="greenVisible" maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
            <Rect x="0" y="0" width={VB_W} height={VB_H} fill="#fff" />
            <G clipPath="url(#bottomHalf)">
              <Ring stroke="#000" x={RED_X} width={RED_W} strokeWidth={KNOCKOUT} />
            </G>
          </Mask>

          {/* Red is hidden where green crosses it, above the centre line. */}
          <Mask id="redVisible" maskUnits="userSpaceOnUse" x="0" y="0" width={VB_W} height={VB_H}>
            <Rect x="0" y="0" width={VB_W} height={VB_H} fill="#fff" />
            <G clipPath="url(#topHalf)">
              <Ring stroke="#000" x={GREEN_X} width={GREEN_W} strokeWidth={KNOCKOUT} />
            </G>
          </Mask>
        </Defs>

        <G mask="url(#greenVisible)">
          <Ring stroke={colors.logoGreen} x={GREEN_X} width={GREEN_W} />
          <G clipPath="url(#greenCut)">
            <Ring stroke={colors.logoYellow} x={GREEN_X} width={GREEN_W} />
          </G>
        </G>

        <G mask="url(#redVisible)">
          <Ring stroke={colors.logoRed} x={RED_X} width={RED_W} />
          <G clipPath="url(#redCut)">
            <Ring stroke={colors.logoYellow} x={RED_X} width={RED_W} />
          </G>
        </G>
      </Svg>
    </View>
  );
}
