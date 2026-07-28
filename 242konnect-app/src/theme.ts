/**
 * Design tokens from the Sleek project (1kNSsCfTUFD).
 *
 * These are the exact values from the export's `:root` block. Keeping them in
 * one place means a re-export from Sleek only has to update this file rather
 * than every screen, and it keeps the app honest about which colours are real
 * design decisions versus something invented at implementation time.
 */

export const colors = {
  background: '#f8fafc',
  foreground: '#0f172a',
  primary: '#00a651',
  primaryForeground: '#ffffff',
  secondary: '#1e293b',
  secondaryForeground: '#ffffff',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  accent: '#ffcb05',
  accentForeground: '#000000',
  destructive: '#ed1c24',
  card: '#ffffff',
  cardForeground: '#0f172a',
  border: '#e2e8f0',
  input: '#f1f5f9',
  ring: '#00a651',
  /** Category accents, in the export's chart-1..5 order. */
  chart1: '#00a651',
  chart2: '#ffcb05',
  chart3: '#ed1c24',
  chart4: '#3b82f6',
  chart5: '#8b5cf6',
  white: '#ffffff',
} as const;

/**
 * The design's `--radius` is 0.75rem. The web export multiplies radii by 2.5
 * where `corner-shape: squircle` is supported; React Native has no squircle, so
 * radii are used at their base value and read slightly tighter than the web
 * prototype. That is the closest faithful mapping available.
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
  /** Body text — Plus Jakarta Sans. */
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemibold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  /** Headings — Outfit. */
  heading: 'Outfit_700Bold',
  headingSemibold: 'Outfit_600SemiBold',
} as const;

/**
 * The export leans on Tailwind's default shadow scale. These approximate
 * `shadow-sm` and `shadow-lg` closely enough to read the same on device, with
 * elevation set alongside so Android matches iOS.
 */
export const shadow = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  primaryGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
