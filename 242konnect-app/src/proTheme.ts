/**
 * Mode Pro — how the app looks while the Prestataire profile is active.
 *
 * One account carries two profiles (§9.10), and until now both looked the
 * same: switching to Prestataire changed a chip on the Profil screen and
 * nothing else, so a provider could not tell at a glance which hat they were
 * wearing. Two-sided marketplaces solve this the same way — the driver and the
 * rider, the host and the guest each get their own look — and so does this.
 *
 *   Particulier  light ground, white cards, black actions, yellow as accent
 *   Prestataire  anthracite ground, raised dark cards, yellow actions
 *
 * Nothing here leaves the charte: it is the same black, grey and yellow, with
 * the anthracite and metal grey the founder named for the opening screen. The
 * inversion is the point — in Mode Pro yellow carries the action instead of
 * black, which is the one change anyone notices immediately.
 *
 * The marketplace itself stays the same for both profiles: a prestataire is a
 * customer too, and taking search and booking away from them was a bug that
 * has already been fixed once. Mode Pro changes the chrome — tab bar, header,
 * Profil — and the provider's own space, not what they can do.
 */

import { useAuth } from './auth';
import { colors } from './theme';

export const pro = {
  /** Page ground. A touch darker than the anthracite cards on it. */
  ground: '#0e1014',
  /** Cards, the tab bar, headers. */
  surface: colors.anthracite,
  /** Inputs and cells inside a card. */
  raised: '#232730',
  line: 'rgba(233,236,239,0.10)',
  text: '#f4f5f7',
  muted: '#9ba3ae',
  /** Yellow is the action colour in Mode Pro, with black type on it. */
  accent: colors.accent,
  accentText: colors.black,
  accentSoft: 'rgba(251,210,24,0.14)',

  /** State colours lifted for a dark ground; same meaning as in theme.ts. */
  success: '#4ade80',
  successSurface: 'rgba(74,222,128,0.12)',
  warning: '#fbbf24',
  warningSurface: 'rgba(251,191,36,0.12)',
  destructive: '#f87171',
} as const;

/** True while the account is acting as a prestataire. */
export function useProMode(): boolean {
  const { account } = useAuth();
  return account?.activeProfile === 'prestataire';
}
