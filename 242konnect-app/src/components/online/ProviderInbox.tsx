import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth';
import {
  getAddress,
  getListing,
  isExpired,
  listIncoming,
  marketplaceEnabled,
  requestAction,
  type Listing,
  type RemoteRequest,
} from '../../marketplace';
import { formatAmount } from '../../pricing';
import { settle } from '../../payments';
import { STAGES } from '../../store';
import type { SupabaseSession } from '../../supabase';
import { colors, fonts } from '../../theme';
import { useT } from '../../i18n';
import { onlineStyles as o, RequestChatSheet, requestStatusLabel, STAGE_LABELS, StageTracker, useMarketData } from './shared';

type Inbox = { listing: Listing | null; requests: RemoteRequest[]; addresses: Record<string, string> };

async function loadInbox(session: SupabaseSession): Promise<Inbox> {
  const [listing, requests] = await Promise.all([getListing(session, session.userId), listIncoming(session)]);
  // The database releases an address only once the request is accepted, so
  // asking for the others returns nothing — Prestataire §09.
  const accepted = requests.filter((r) => ['accepted', 'validated', 'disputed'].includes(r.status));
  const pairs = await Promise.all(
    accepted.map(async (r) => [r.id, (await getAddress(session, r.id).catch(() => null)) ?? ''] as const)
  );
  return { listing, requests, addresses: Object.fromEntries(pairs) };
}

/**
 * What reaches a prestataire from the server: their review status, and the
 * requests clients have paid for. Prestataire §08 asks for counters "provenant
 * des données réelles" — these are; the zeros elsewhere were placeholders.
 */
export function ProviderInbox() {
  const t = useT();
  const { account, marketSession } = useAuth();
  const { data, error, refresh } = useMarketData(loadInbox, 15000);
  const [chat, setChat] = useState<RemoteRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!marketplaceEnabled || !account?.profiles.includes('prestataire')) return null;

  const act = async (r: RemoteRequest, action: 'accept' | 'decline' | 'advance') => {
    setActionError(null);
    const session = await marketSession();
    if (!session) return setActionError(t('Votre session a expiré. Reconnectez-vous.'));
    try {
      await requestAction(session, r.id, action);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const listing = data?.listing;
  const requests = data?.requests ?? [];
  const count = (pred: (r: RemoteRequest) => boolean) => requests.filter(pred).length;
  const approved = listing?.status === 'approved';

  return (
    <View style={styles.root}>
      <Text style={o.sectionTitle}>{t('Statut 242Konnect')}</Text>
      <View style={o.card}>
        {!data && !error && <Text style={o.line}>{t('Chargement…')}</Text>}
        {!!error && <Text style={o.error}>{error}</Text>}
        {data && !listing && (
          <Text style={o.line}>{t("Votre profil n'est pas encore publié. Il le sera à votre prochaine connexion en ligne.")}</Text>
        )}
        {listing && (
          <>
            <Text style={o.body}>
              {listing.status === 'approved'
                ? t('Profil approuvé : les clients peuvent vous réserver.')
                : listing.status === 'refused'
                  ? t('Profil refusé. Corrigez-le depuis Modifier le profil : il repassera en examen.')
                  : t('Profil publié, en examen par 242Konnect : visible avec un badge, pas encore réservable.')}
            </Text>
            {!!listing.refusalReason && (
              <Text style={o.line}>
                {t('Motif')} : {listing.refusalReason}
              </Text>
            )}
          </>
        )}
      </View>

      <Text style={o.sectionTitle}>{t('Demandes reçues')}</Text>
      <View style={styles.counts}>
        <Count label={t('Nouvelles')} value={count((r) => r.status === 'sent' && !isExpired(r))} />
        <Count label={t('Acceptées')} value={count((r) => r.status === 'accepted' && r.stage === 'accepted')} />
        <Count label={t('En cours')} value={count((r) => r.status === 'accepted' && r.stage !== 'accepted')} />
        <Count label={t('Terminées')} value={count((r) => r.status === 'validated')} />
        <Count label={t('Annulées')} value={count((r) => r.status === 'cancelled' || r.status === 'refused')} />
      </View>
      {!!actionError && <Text style={o.error}>{actionError}</Text>}
      {data && requests.length === 0 && (
        <Text style={o.line}>{t('Les demandes payées par les clients arriveront ici.')}</Text>
      )}

      {requests.map((r) => {
        const expired = isExpired(r);
        const next = r.stage ? STAGES[STAGES.indexOf(r.stage) + 1] : undefined;
        return (
          <View key={r.id} style={o.card}>
            <View style={o.head}>
              <View style={o.headBody}>
                <Text style={o.name}>{r.clientName || t('Client')}</Text>
                <Text style={o.sub}>
                  {t(r.slot)} · {r.zoneHint}
                </Text>
              </View>
              <View style={o.chip}>
                <Text style={o.chipText}>{t(requestStatusLabel(r))}</Text>
              </View>
            </View>
            {!!r.description && <Text style={o.body}>{r.description}</Text>}
            <Text style={o.amount}>
              {formatAmount(r.amount, r.currency)} · {t('vous recevrez')} {formatAmount(settle(r.amount, 'standard').net, r.currency)}
            </Text>

            {r.status === 'sent' && !expired && (
              <>
                <Text style={o.line}>
                  {t('Paiement bloqué par 242Konnect. Adresse exacte et coordonnées communiquées après acceptation. Répondez avant')}{' '}
                  {r.responseDeadline ? new Date(r.responseDeadline).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}.
                </Text>
                {!approved && <Text style={o.error}>{t("Votre profil doit être approuvé pour accepter une demande.")}</Text>}
                <View style={o.actions}>
                  <Pressable onPress={() => act(r, 'decline')} accessibilityRole="button" accessibilityLabel={t('Refuser la demande')} style={o.ghost}>
                    <Text style={o.ghostLabel}>{t('Refuser')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setChat(r)} accessibilityRole="button" accessibilityLabel={t('Ouvrir le chat de la demande')} style={o.ghost}>
                    <Text style={o.ghostLabel}>{t('Message')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => act(r, 'accept')}
                    disabled={!approved}
                    accessibilityRole="button"
                    accessibilityLabel={t('Accepter la demande')}
                    style={[o.solid, !approved && o.solidOff]}
                  >
                    <Text style={o.solidLabel}>{t('Accepter')}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {r.status === 'accepted' && (
              <>
                <Text style={o.body}>
                  {t('Adresse')} : {data?.addresses[r.id] || '—'}
                </Text>
                <StageTracker request={r} />
                <View style={o.actions}>
                  <Pressable onPress={() => setChat(r)} accessibilityRole="button" accessibilityLabel={t('Ouvrir le chat de la demande')} style={o.ghost}>
                    <Text style={o.ghostLabel}>{t('Message')}</Text>
                  </Pressable>
                  {next && (
                    <Pressable
                      onPress={() => act(r, 'advance')}
                      accessibilityRole="button"
                      accessibilityLabel={`${t('Étape suivante')} ${t(STAGE_LABELS[next])}`}
                      style={o.solid}
                    >
                      <Text style={o.solidLabel}>{t(STAGE_LABELS[next])}</Text>
                    </Pressable>
                  )}
                </View>
                {r.stage === 'completed' && (
                  <Text style={o.line}>{t('Clôture demandée : le client valide ou signale un problème. Le paiement est versé après sa validation.')}</Text>
                )}
              </>
            )}
            {r.status === 'disputed' && (
              <Text style={o.line}>{t('Le client a signalé un problème. Les fonds sont gelés pendant l’examen ; répondez dans le chat.')}</Text>
            )}
          </View>
        );
      })}

      <RequestChatSheet request={chat} title={t('Chat de la demande')} onClose={() => setChat(null)} />
    </View>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  counts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  count: { flexGrow: 1, flexBasis: '18%', padding: 10, borderRadius: 12, backgroundColor: colors.muted, alignItems: 'center' },
  countValue: { fontFamily: fonts.headingBold, fontSize: 18, color: colors.foreground },
  countLabel: { fontFamily: fonts.sansMedium, fontSize: 10, color: colors.mutedForeground },
});
