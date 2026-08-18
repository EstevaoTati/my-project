/**
 * Design tokens — the official 242Konnect charte graphique.
 *
 * The directives fix the palette as black, grey and yellow (accent), with
 * Manrope SemiBold for titles and Inter for text and buttons. That replaces the
 * Sleek export's green/yellow/red and Outfit/Plus Jakarta Sans, which were the
 * design tool's defaults rather than the brand.
 *
 * Black carries the primary actions and yellow is reserved as the accent, the
 * way the directives describe it and the way the named references (Uber,
 * Airbnb, Stripe) use a restrained ground with one signal colour. Spending the
 * yellow on every surface would leave nothing to draw the eye.
 *
 * Token names are unchanged from the previous palette so screens keep reading
 * from one place; only the values moved.
 */

export const colors = {
  background: '#fafafa',
  foreground: '#0a0a0a',

  /** Primary actions: black, per the charte. Yellow is the accent, not the CTA. */
  primary: '#111111',
  primaryForeground: '#ffffff',

  secondary: '#262626',
  secondaryForeground: '#ffffff',

  muted: '#f4f4f5',
  mutedForeground: '#6b7280',

  /** The brand yellow. Highlights, badges, selected states — used sparingly. */
  accent: '#ffcb05',
  accentForeground: '#0a0a0a',

  card: '#ffffff',
  cardForeground: '#0a0a0a',
  border: '#e5e5e5',
  input: '#f4f4f5',
  ring: '#111111',

  /**
   * Semantic status colours, deliberately separate from the brand palette:
   * a validated mission and a failed payment have to be legible as states, and
   * the charte's three colours cannot carry that on their own.
   */
  success: '#15803d',
  successSurface: '#f0fdf4',
  warning: '#b45309',
  warningSurface: '#fffbeb',
  destructive: '#b91c1c',
  destructiveSurface: '#fef2f2',

  white: '#ffffff',
  black: '#0a0a0a',

  /**
   * Logo palette — the flag of the Republic of the Congo.
   *
   * Sampled from the reference flag, not carried over from the design export:
   * that had drifted to #00a651 / #ffcb05 / #ed1c24, a brighter green and an
   * orange-leaning red.
   *
   * Deliberately separate from the interface tokens above. The directives fix
   * the *interface* charte as black, grey and yellow; the mark carries the
   * national colours the brand is named after. Keeping them in different
   * buckets stops the flag colours leaking back into buttons and chips.
   */
  logoGreen: '#009739',
  logoYellow: '#ffd100',
  logoRed: '#dc241f',

  /**
   * Neutral tones for generated avatars. Varied enough to tell people apart in
   * a list, all within the charte's greyscale rather than inventing colours.
   */
  avatarTones: ['#111827', '#1f2937', '#374151', '#4b5563', '#525252'],
} as const;

/**
 * `--radius` stays at 0.75rem. The web export multiplies radii by 2.5 where
 * `corner-shape: squircle` is supported; React Native has no squircle, so radii
 * are used at their base value and read slightly tighter than the web build.
 */
const RADIUS = 12;

export const radius = {
  xs: RADIUS - 8,
  sm: RADIUS - 4,
  md: RADIUS - 2,
  lg: RADIUS,
  xl: RADIUS + 4,
  '2xl': RADIUS + 8,
  '3xl': RADIUS + 16,
  full: 9999,
} as const;

export const fonts = {
  /** Body — Inter Regular, per the charte. */
  sans: 'Inter_400Regular',
  /** Buttons — Inter Medium, per the charte. */
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  /** Titles — Manrope SemiBold, per the charte. */
  heading: 'Manrope_600SemiBold',
  /** Reserved for the wordmark and large display numerals. */
  headingBold: 'Manrope_700Bold',
} as const;

/**
 * Shadows are quieter than the export's Tailwind scale: on a near-white ground
 * with black type, heavy shadows read as muddy rather than elevated.
 */
export const shadow = {
  sm: {
    shadowColor: '#0a0a0a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  lg: {
    shadowColor: '#0a0a0a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryGlow: {
    shadowColor: '#0a0a0a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;

/** Deterministic avatar tone, so a given person keeps the same one. */
export function toneFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return colors.avatarTones[hash % colors.avatarTones.length];
}
