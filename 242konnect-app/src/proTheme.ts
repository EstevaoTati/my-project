/**
 * Mode Pro — how the app looks while the Prestataire profile is active.
 *
 * Since 2026-10-20 it follows the founder's mock-ups ("App V1 Parcours
 * Prestataire", "Boutons Jobs, Publier et Messages"): the same light ground as
 * the client side, with yellow carrying the active tab, the centre button and
 * the key highlights, and black for the primary buttons. The dark anthracite
 * palette of 2026-10-19 is retired.
 *
 * What tells the two hats apart is now the content, as the specs ask: in
 * provider mode the home is a dashboard, Missions lists jobs, and the
 * marketplace of competitors is not browsable (spec §14). Switching to Client
 * mode from Profil gives the full marketplace back, with the same account.
 *
 * Token names are unchanged, so the screens that read them follow.
 */

import { useAuth } from './auth';
import { colors } from './theme';

export const pro = {
  ground: colors.background,
  surface: colors.card,
  /** Inputs, segmented controls and cells inside a card. */
  raised: colors.muted,
  line: colors.border,
  text: colors.foreground,
  muted: colors.mutedForeground,
  /** Yellow: active tab, centre button, selected segment, highlights. */
  accent: colors.accent,
  accentText: colors.black,
  accentSoft: '#fff7d1',
  /** Primary buttons stay black, as in the mock-ups. */
  action: colors.primary,
  actionText: colors.primaryForeground,

  success: colors.success,
  successSurface: colors.successSurface,
  warning: colors.warning,
  warningSurface: colors.warningSurface,
  destructive: colors.destructive,
} as const;

/** True while the account is acting as a prestataire. */
export function useProMode(): boolean {
  const { account } = useAuth();
  return account?.activeProfile === 'prestataire';
}
