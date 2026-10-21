/**
 * The prestataire's workspace: the data and the pieces the dashboard, Jobs
 * and Messages share (docs/242konnect-prestataire-v1-plan.md, phase 1).
 *
 * Everything shown here comes from the server, as the spec asks ("les
 * compteurs doivent provenir des données réelles"). What a prestataire may
 * see — which open requests, which address — is decided by the database; the
 * screens only ask and render.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { Sheet } from '../../components/Sheet';
import { useAuth } from '../../auth';
import { categories, getTrade } from '../../data/trades';
import type { IconName } from '../../icons';
import {
  claimRequest,
  dismissRequest,
  getAddress,
  getListing,
  isExpired,
  listDismissals,
  listIncoming,
  listOpenRequests,
  requestAction,
  setAvailable,
  type Dismissal,
  type Listing,
  type RemoteRequest,
} from '../../marketplace';
import { DURATIONS, formatAmount } from '../../pricing';
import { settle } from '../../payments';
import { STAGES } from '../../store';
import type { SupabaseSession } from '../../supabase';
import { colors, fonts, radius } from '../../theme';
import { T, useT } from '../../i18n';
import { RequestChatSheet, STAGE_LABELS, StageTracker, useMarketData } from '../../components/online/shared';

export type Workspace = {
  listing: Listing | null;
  /** Requests addressed to this prestataire, and open ones they claimed. */
  mine: RemoteRequest[];
  /** Open requests they may take now. */
  open: RemoteRequest[];
  dismissals: Dismissal[];
  /** Exact addresses, released by the database once a request is accepted. */
  addresses: Record<string, string>;
};

async function loadWorkspace(session: SupabaseSession): Promise<Workspace> {
  const [listing, mine, open, dismissals] = await Promise.all([
    getListing(session, session.userId),
    listIncoming(session),
    listOpenRequests(session).catch(() => [] as RemoteRequest[]),
    listDismissals(session).catch(() => [] as Dismissal[]),
  ]);
  const accepted = mine.filter((r) => ['accepted', 'validated', 'disputed'].includes(r.status));
  const pairs = await Promise.all(
    accepted.map(async (r) => [r.id, (await getAddress(session, r.id).catch(() => null)) ?? ''] as const)
  );
  return { listing, mine, open, dismissals, addresses: Object.fromEntries(pairs) };
}

export function useWorkspace() {
  return useMarketData(loadWorkspace, 15000);
}

/* ------------------------------------------------------------------ */
/* Sorting requests into the spec's states                            */
/* ------------------------------------------------------------------ */

export type JobState = 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export const JOB_STATES: { id: JobState; label: string }[] = [
  { id: 'accepted', label: T('Acceptées') },
  { id: 'in_progress', label: T('En cours') },
  { id: 'completed', label: T('Terminées') },
  { id: 'cancelled', label: T('Annulées') },
];

/** Where a mission of this prestataire sits; null while it is still a request. */
export function jobState(r: RemoteRequest): JobState | null {
  if (r.status === 'accepted') return r.stage && r.stage !== 'accepted' ? (r.stage === 'completed' ? 'completed' : 'in_progress') : 'accepted';
  if (r.status === 'validated' || r.status === 'disputed') return 'completed';
  if (r.status === 'cancelled' || r.status === 'refused') return 'cancelled';
  return null;
}

/** Requests waiting for this prestataire's answer: open ones and those addressed to them. */
export function availableRequests(w: Workspace | null): RemoteRequest[] {
  if (!w) return [];
  const directed = w.mine.filter((r) => r.status === 'sent' && !isExpired(r));
  return [...directed, ...w.open.filter((r) => !isExpired(r))];
}

export function jobs(w: Workspace | null, state?: JobState): RemoteRequest[] {
  if (!w) return [];
  return w.mine.filter((r) => {
    const s = jobState(r);
    return s !== null && (!state || s === state);
  });
}

/** What reaches the prestataire this calendar month, after commission (§12). */
export function earnedThisMonth(w: Workspace | null): number {
  if (!w) return 0;
  const now = new Date();
  return w.mine
    .filter((r) => r.status === 'validated')
    .filter((r) => {
      const d = new Date(r.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((sum, r) => sum + settle(r.amount, 'standard').net, 0);
}

/* ------------------------------------------------------------------ */
/* Small formatting helpers                                           */
/* ------------------------------------------------------------------ */

export function tradeLabel(tradeId: string): string {
  return getTrade(tradeId)?.label ?? tradeId;
}

export function tradeIcon(tradeId: string): IconName {
  const category = getTrade(tradeId)?.category;
  return categories.find((c) => c.id === category)?.icon ?? 'mdi:wrench';
}

export function durationLabel(id: string): string {
  return DURATIONS.find((d) => d.id === id)?.label ?? id;
}

/** "Expire dans 2 h 18" — the spec shows the deadline on every request card. */
export function expiresIn(r: RemoteRequest, t: (s: string, v?: Record<string, string | number>) => string): string | null {
  if (!r.responseDeadline) return null;
  const mins = Math.round((Date.parse(r.responseDeadline) - Date.now()) / 60000);
  if (mins <= 0) return t('Expirée');
  if (mins < 60) return t('Expire dans {m} min', { m: mins });
  const h = Math.floor(mins / 60);
  if (h < 24) return t('Expire dans {h} h {m}', { h, m: String(mins % 60).padStart(2, '0') });
  return t('Expire dans {d} j', { d: Math.round(h / 24) });
}

/** "Mpaka · Pointe-Noire", without saying the city twice. */
export function place(r: { zoneHint: string; city: string }): string {
  return [...new Set([r.zoneHint.trim(), r.city.trim()].filter(Boolean))].join(' · ');
}

/** "Sarah K." — the client's name without the rest, until the job is theirs. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                             */
/* ------------------------------------------------------------------ */

/** Jobs §1.1: off, the prestataire keeps their missions but receives no new requests. */
export function AvailableToggle({ listing, onChanged }: { listing: Listing | null; onChanged: () => void }) {
  const t = useT();
  const { marketSession } = useAuth();
  const [pending, setPending] = useState<boolean | null>(null);
  if (!listing) return null;
  const on = pending ?? listing.available;
  const toggle = async () => {
    const next = !on;
    setPending(next);
    const session = await marketSession();
    if (!session) return setPending(null);
    try {
      await setAvailable(session, next);
      onChanged();
    } catch {
      // Back to what the server says.
    } finally {
      setPending(null);
    }
  };
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      aria-checked={on}
      accessibilityLabel={t('Disponible')}
      style={[s.toggle, on ? s.toggleOn : s.toggleOff]}
    >
      <View style={[s.knobTrack, on && s.knobTrackOn]}>
        <View style={[s.knob, on && s.knobOn]} />
      </View>
      <Text style={[s.toggleLabel, on && s.toggleLabelOn]}>{on ? t('Disponible') : t('Indisponible')}</Text>
    </Pressable>
  );
}

export function Segmented<Id extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: Id; label: string }[];
  value: Id;
  onChange: (id: Id) => void;
  label: string;
}) {
  const t = useT();
  return (
    <View style={s.segmented} accessibilityRole="tablist" accessibilityLabel={label}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            aria-selected={active}
            accessibilityLabel={t(o.label)}
            style={[s.segment, active && s.segmentOn]}
          >
            <Text style={[s.segmentLabel, active && s.segmentLabelOn]} numberOfLines={1}>
              {t(o.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TradeBadge({ tradeId }: { tradeId: string }) {
  return (
    <View style={s.tradeBadge}>
      <Icon name={tradeIcon(tradeId)} size={22} color={colors.foreground} />
    </View>
  );
}

/** A request card: Available requests on the dashboard and in Jobs. */
export function RequestCard({ request, onOpen }: { request: RemoteRequest; onOpen: () => void }) {
  const t = useT();
  const open = request.providerId === null;
  const expiry = expiresIn(request, t);
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <TradeBadge tradeId={request.tradeId} />
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {t(tradeLabel(request.tradeId))}
          </Text>
          <Text style={s.cardMeta} numberOfLines={1}>
            {place(request)}
          </Text>
          <Text style={s.cardMeta} numberOfLines={1}>
            {t(request.slot)}
          </Text>
        </View>
        <View style={s.cardSide}>
          <Text style={s.amount}>{formatAmount(request.amount, request.currency)}</Text>
          {!!expiry && <Text style={s.expiry}>{expiry}</Text>}
          {!open && <Text style={s.forYou}>{t('Pour vous')}</Text>}
        </View>
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${t('Voir la demande')} ${t(tradeLabel(request.tradeId))}`}
        style={s.darkButton}
      >
        <Text style={s.darkButtonLabel}>{t('Voir la demande')}</Text>
      </Pressable>
    </View>
  );
}

/** A mission card: My jobs. */
export function JobCard({ request, onOpen }: { request: RemoteRequest; onOpen: () => void }) {
  const t = useT();
  const state = jobState(request);
  const label =
    request.status === 'validated'
      ? t('Validée')
      : request.status === 'disputed'
        ? t('Litige')
        : request.status === 'refused'
          ? t('Refusée')
          : request.status === 'cancelled'
            ? t('Annulée')
            : t(STAGE_LABELS[request.stage ?? 'accepted']);
  const live = state === 'accepted' || state === 'in_progress';
  return (
    <View style={s.card}>
      <View style={s.cardRow}>
        <TradeBadge tradeId={request.tradeId} />
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {t(tradeLabel(request.tradeId))}
          </Text>
          <Text style={s.cardMeta} numberOfLines={1}>
            {shortName(request.clientName) || t('Client')}
          </Text>
          <Text style={s.cardMeta} numberOfLines={1}>
            {[t(request.slot), request.zoneHint].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={s.cardSide}>
          <Text style={s.amount}>{formatAmount(request.amount, request.currency)}</Text>
          <View style={[s.stateChip, state === 'in_progress' && s.stateChipLive, state === 'cancelled' && s.stateChipOff]}>
            <Text style={s.stateChipLabel}>{label}</Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${live ? t('Continuer la mission') : t('Ouvrir la mission')} ${t(tradeLabel(request.tradeId))}`}
        style={live ? s.darkButton : s.lightButton}
      >
        <Text style={live ? s.darkButtonLabel : s.lightButtonLabel}>
          {state === 'in_progress' ? t('Continuer la mission') : t('Ouvrir la mission')}
        </Text>
      </Pressable>
    </View>
  );
}

/** History: an open request declined, lost to another prestataire, or expired. */
export function DismissalCard({ item }: { item: Dismissal }) {
  const t = useT();
  const title =
    item.reason === 'assigned' ? t('Déjà attribuée') : item.reason === 'expired' ? t('Expirée') : t('Refusée');
  const body =
    item.reason === 'assigned'
      ? t('Un autre prestataire a accepté cette demande. Elle n’est plus disponible.')
      : item.reason === 'expired'
        ? t('Le délai de réponse était dépassé.')
        : t('Vous avez indiqué que cette demande n’était pas pour vous.');
  return (
    <View style={[s.card, s.cardMutedBg]}>
      <View style={s.cardRow}>
        <TradeBadge tradeId={item.tradeId} />
        <View style={s.cardBody}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardMeta}>{body}</Text>
          <Text style={s.cardMeta} numberOfLines={1}>
            {[t(tradeLabel(item.tradeId)), item.zoneHint, t(item.slot)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function StatTile({ icon, label, value, tint }: { icon: IconName; label: string; value: string; tint: string }) {
  return (
    <View style={[s.stat, { backgroundColor: tint }]} accessibilityLabel={`${label} ${value}`}>
      <View style={s.statIcon}>
        <Icon name={icon} size={18} color={colors.foreground} />
      </View>
      <Text style={s.statLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Request detail (spec 09, Jobs §1.4)                                */
/* ------------------------------------------------------------------ */

export function RequestSheet({
  request,
  onClose,
  onDone,
}: {
  request: RemoteRequest | null;
  onClose: () => void;
  /** After an answer: refresh, and open the mission when it was accepted. */
  onDone: (accepted: RemoteRequest | null) => void;
}) {
  const t = useT();
  const { marketSession } = useAuth();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<RemoteRequest | null>(null);
  const open = request?.providerId === null;

  const answer = async (kind: 'accept' | 'decline') => {
    if (!request) return;
    setBusy(kind);
    setError(null);
    try {
      const session = await marketSession();
      if (!session) throw new Error(t('Votre session a expiré. Reconnectez-vous.'));
      if (open) {
        if (kind === 'decline') {
          await dismissRequest(session, request.id);
          return onDone(null);
        }
        const result = await claimRequest(session, request.id);
        if (result === 'claimed') return onDone({ ...request, providerId: session.userId, status: 'accepted', stage: 'accepted' });
        throw new Error(
          result === 'already_assigned'
            ? t('Un autre prestataire a déjà accepté cette demande. Elle reste dans votre historique.')
            : result === 'expired'
              ? t('Cette demande a expiré.')
              : t('Cette demande n’est plus disponible.')
        );
      }
      const updated = await requestAction(session, request.id, kind);
      onDone(kind === 'accept' ? updated : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Action impossible.'));
    } finally {
      setBusy(null);
    }
  };

  const expiry = request ? expiresIn(request, t) : null;

  return (
    <>
      <Sheet visible={!!request} title={t('Demande de service')} onClose={onClose}>
        {request && (
          <View style={s.sheetBody}>
            {!!expiry && (
              <View style={s.expiryChip}>
                <Icon name="solar:calendar-mark-linear" size={14} color={colors.foreground} />
                <Text style={s.expiryChipLabel}>{expiry}</Text>
              </View>
            )}
            <View style={s.clientRow}>
              <View style={s.initials}>
                <Text style={s.initialsText}>{(request.clientName.trim()[0] ?? '?').toUpperCase()}</Text>
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{shortName(request.clientName) || t('Client')}</Text>
                <Text style={s.cardMeta}>{place(request)}</Text>
              </View>
            </View>
            <Text style={s.sheetTitle}>{t(tradeLabel(request.tradeId))}</Text>
            <View style={s.facts}>
              <Fact icon="solar:calendar-mark-linear" label={t('Date souhaitée')} value={t(request.slot)} />
              <Fact icon="solar:sort-from-top-to-bottom-bold" label={t('Durée')} value={t(durationLabel(request.duration))} />
              <Fact icon="solar:tuning-square-2-bold" label={t('Budget')} value={formatAmount(request.amount, request.currency)} />
              <Fact icon="solar:shield-check-bold" label={t('Paiement')} value={t('Sécurisé par 242Konnect')} />
            </View>
            {!!request.description && (
              <>
                <Text style={s.sectionLabel}>{t('Description')}</Text>
                <Text style={s.description}>{request.description}</Text>
              </>
            )}
            <View style={s.lockNote}>
              <Icon name="solar:shield-check-bold" size={16} color={colors.mutedForeground} />
              <Text style={s.lockNoteText}>{t('Les coordonnées du client restent privées jusqu’à votre acceptation.')}</Text>
            </View>
            {!!error && <Text style={s.error}>{error}</Text>}
            <View style={s.actionsRow}>
              <Pressable
                onPress={() => answer('decline')}
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel={t('Refuser la demande')}
                style={s.lightButtonFlex}
              >
                <Text style={s.lightButtonLabel}>{busy === 'decline' ? t('Envoi…') : t('Refuser')}</Text>
              </Pressable>
              {!open && (
                <Pressable
                  onPress={() => setChat(request)}
                  accessibilityRole="button"
                  accessibilityLabel={t('Écrire au client')}
                  style={s.lightButtonFlex}
                >
                  <Text style={s.lightButtonLabel}>{t('Message')}</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => answer('accept')}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel={t('Accepter la demande')}
              style={[s.darkButton, !!busy && s.off]}
            >
              <Text style={s.darkButtonLabel}>{busy === 'accept' ? t('Envoi…') : t('Accepter la demande')}</Text>
            </Pressable>
            {open && (
              <Text style={s.footnote}>
                {t('Cette demande est envoyée à plusieurs prestataires de votre zone : le premier qui accepte obtient la mission.')}
              </Text>
            )}
          </View>
        )}
      </Sheet>
      <RequestChatSheet request={chat} title={t('Chat de la demande')} onClose={() => setChat(null)} />
    </>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={s.fact}>
      <View style={s.factIcon}>
        <Icon name={icon} size={16} color={colors.foreground} />
      </View>
      <View style={s.cardBody}>
        <Text style={s.factLabel}>{label}</Text>
        <Text style={s.factValue}>{value}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Mission in progress (spec 10)                                      */
/* ------------------------------------------------------------------ */

export function JobSheet({
  request,
  address,
  onClose,
  onChanged,
}: {
  request: RemoteRequest | null;
  address?: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const t = useT();
  const { marketSession } = useAuth();
  const [current, setCurrent] = useState<RemoteRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<RemoteRequest | null>(null);
  const r = current && request && current.id === request.id ? current : request;
  const next = r?.status === 'accepted' && r.stage ? STAGES[STAGES.indexOf(r.stage) + 1] : undefined;

  const advance = async () => {
    if (!r) return;
    setBusy(true);
    setError(null);
    try {
      const session = await marketSession();
      if (!session) throw new Error(t('Votre session a expiré. Reconnectez-vous.'));
      setCurrent(await requestAction(session, r.id, 'advance'));
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Action impossible.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet visible={!!request} title={t('Mission')} onClose={onClose}>
        {r && (
          <View style={s.sheetBody}>
            <View style={s.cardRow}>
              <TradeBadge tradeId={r.tradeId} />
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{t(tradeLabel(r.tradeId))}</Text>
                <Text style={s.cardMeta}>{r.clientName || t('Client')}</Text>
                <Text style={s.cardMeta}>{t(r.slot)}</Text>
              </View>
              <Text style={s.amount}>{formatAmount(r.amount, r.currency)}</Text>
            </View>
            {!!address && (
              <View style={s.fact}>
                <View style={s.factIcon}>
                  <Icon name="solar:map-point-bold" size={16} color={colors.foreground} />
                </View>
                <View style={s.cardBody}>
                  <Text style={s.factLabel}>{t('Adresse')}</Text>
                  <Text style={s.factValue}>{address}</Text>
                </View>
              </View>
            )}
            <StageTracker request={r} />
            {!!error && <Text style={s.error}>{error}</Text>}
            {next && (
              <Pressable
                onPress={advance}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${t('Étape suivante')} ${t(STAGE_LABELS[next])}`}
                style={[s.darkButton, busy && s.off]}
              >
                <Text style={s.darkButtonLabel}>
                  {next === 'completed' ? t('Terminer la mission') : `${t('Étape suivante')} : ${t(STAGE_LABELS[next])}`}
                </Text>
              </Pressable>
            )}
            {r.status === 'accepted' && r.stage === 'completed' && (
              <Text style={s.footnote}>{t('Le client confirme le résultat ou signale un problème. Le paiement est ensuite libéré.')}</Text>
            )}
            {['sent', 'accepted', 'disputed'].includes(r.status) && (
              <Pressable
                onPress={() => setChat(r)}
                accessibilityRole="button"
                accessibilityLabel={t('Ouvrir le chat de la demande')}
                style={s.lightButton}
              >
                <Text style={s.lightButtonLabel}>{t('Écrire au client')}</Text>
              </Pressable>
            )}
            <View style={s.lockNote}>
              <Icon name="solar:shield-check-bold" size={16} color={colors.mutedForeground} />
              <Text style={s.lockNoteText}>{t('Le paiement est conservé par 242Konnect jusqu’à la validation du client.')}</Text>
            </View>
          </View>
        )}
      </Sheet>
      <RequestChatSheet request={chat} title={t('Chat de la demande')} onClose={() => setChat(null)} />
    </>
  );
}

/* ------------------------------------------------------------------ */

export const s = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 12,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: colors.successSurface, borderColor: '#bbf7d0' },
  toggleOff: { backgroundColor: colors.muted, borderColor: colors.border },
  knobTrack: { width: 38, height: 22, borderRadius: 11, backgroundColor: colors.border, padding: 2 },
  knobTrackOn: { backgroundColor: colors.success },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white },
  knobOn: { transform: [{ translateX: 16 }] },
  toggleLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.mutedForeground },
  toggleLabelOn: { color: colors.success },

  segmented: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.xl, padding: 4, gap: 4 },
  segment: { flex: 1, height: 36, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segmentOn: { backgroundColor: colors.accent },
  segmentLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  segmentLabelOn: { fontFamily: fonts.sansBold, color: colors.accentForeground },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  cardMutedBg: { backgroundColor: colors.muted },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardBody: { flex: 1, gap: 2 },
  cardSide: { alignItems: 'flex-end', gap: 4, maxWidth: 140 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  cardMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  amount: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground, textAlign: 'right' },
  expiry: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.warning },
  forYou: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.foreground, backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden' },
  tradeBadge: { width: 48, height: 48, borderRadius: radius.xl, backgroundColor: '#fff7d1', alignItems: 'center', justifyContent: 'center' },
  stateChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.accent },
  stateChipLive: { backgroundColor: colors.successSurface },
  stateChipOff: { backgroundColor: colors.muted },
  stateChipLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.foreground },

  darkButton: { height: 46, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  darkButtonLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryForeground },
  lightButton: { height: 46, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  lightButtonFlex: { flex: 1, height: 46, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  lightButtonLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  off: { opacity: 0.5 },
  actionsRow: { flexDirection: 'row', gap: 10 },

  stat: { flex: 1, minWidth: 0, borderRadius: radius.xl, padding: 10, gap: 4 },
  statIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.mutedForeground },
  statValue: { fontFamily: fonts.headingBold, fontSize: 18, color: colors.foreground },

  sheetBody: { gap: 14 },
  sheetTitle: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.foreground },
  expiryChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff7d1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  expiryChipLabel: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.foreground },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  initials: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.foreground },
  facts: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingHorizontal: 12 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  factIcon: { width: 32, height: 32, borderRadius: radius.lg, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  factLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  factValue: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  sectionLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.foreground },
  description: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.muted, borderRadius: radius.lg, padding: 10 },
  lockNoteText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  footnote: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.mutedForeground, textAlign: 'center' },
});
