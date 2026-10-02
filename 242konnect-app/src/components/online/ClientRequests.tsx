import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Sheet } from '../Sheet';
import { Icon } from '../Icon';
import { PhoneField } from '../form';
import { useAuth } from '../../auth';
import { getTrade } from '../../data';
import {
  isExpired,
  listMyRequests,
  marketplaceEnabled,
  requestAction,
  getAddress,
  type RemoteRequest,
} from '../../marketplace';
import { PAYMENT_METHODS, methodNeedsPhone, settle, type PaymentMethod } from '../../payments';
import { pollCollection, requestToPay } from '../../momo';
import { formatAmount } from '../../pricing';
import { DEFAULT_COUNTRY, fromE164, isCompleteNumber, normalizeNational, type CountryCode } from '../../countries';
import { colors, fonts, radius } from '../../theme';
import { T, useT } from '../../i18n';
import { onlineStyles as o, RequestChatSheet, requestStatusLabel, StageTracker, useMarketData } from './shared';

const DISPUTE_REASONS = [T('Travail non conforme'), T('Travail incomplet'), T('Prestataire absent'), T('Dommages'), T('Autre')];
const OUTCOMES: { id: 'redo' | 'partial_refund' | 'full_refund'; label: string }[] = [
  { id: 'redo', label: T('Reprise du travail') },
  { id: 'partial_refund', label: T('Remboursement partiel') },
  { id: 'full_refund', label: T('Remboursement complet') },
];

/**
 * The client's requests to prestataires who signed up on 242Konnect.
 *
 * Every button here calls `request_action` on the server, which is what
 * decides whether it is allowed. The screen only offers what the state permits
 * so nobody is shown a button that will be refused.
 */
export function ClientRequests() {
  const t = useT();
  const { account, marketSession } = useAuth();
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const { data, error, refresh } = useMarketData(listMyRequests, 15000);
  const [paying, setPaying] = useState<RemoteRequest | null>(null);
  const [payAddress, setPayAddress] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [payPhone, setPayPhone] = useState('');
  const [payCountry, setPayCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [chat, setChat] = useState<RemoteRequest | null>(null);
  const [disputing, setDisputing] = useState<RemoteRequest | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]['id'] | null>(null);
  const [details, setDetails] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (!marketplaceEnabled || !account) return null;
  const requests = data ?? [];
  if (requests.length === 0 && !error) return null;

  const methods = PAYMENT_METHODS.filter((m) =>
    account.location.country === 'US' ? m.id === 'carte' || m.id === 'virement' : true
  );

  const act = async (r: RemoteRequest, action: Parameters<typeof requestAction>[2], payload = {}) => {
    setActionError(null);
    const session = await marketSession();
    if (!session) return setActionError(t('Votre session a expiré. Reconnectez-vous.'));
    try {
      await requestAction(session, r.id, action, payload);
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Action impossible.');
    }
  };

  const openPay = async (r: RemoteRequest) => {
    setPaying(r);
    setMethod(null);
    setAuthorized(false);
    setSheetError(null);
    setPayPhone(fromE164(account.phone).national);
    setPayCountry(account.phoneCountry ?? DEFAULT_COUNTRY);
    const session = await marketSession();
    setPayAddress(session ? await getAddress(session, r.id).catch(() => null) : null);
  };

  /**
   * Collects, then records. For Mobile Money the operator has to report the
   * collection successful before `pay` is called; the order's idempotency key
   * goes with both, so a double tap can neither prompt nor record twice.
   */
  const confirmPay = async () => {
    if (!paying || !method) return;
    setBusy(true);
    setSheetError(null);
    try {
      let ref = `242K-${paying.idempotencyKey.slice(-6).toUpperCase()}`;
      if (method === 'mtn' || method === 'airtel') {
        const phone = normalizeNational(payPhone, payCountry);
        const started = await requestToPay({
          operator: method,
          phone,
          amount: paying.amount,
          label: `242Konnect · ${paying.id.slice(0, 6).toUpperCase()}`,
          idempotencyKey: paying.idempotencyKey,
        });
        const settled = await pollCollection(started.id, phone, {});
        if (settled.status !== 'successful') throw new Error(t('Le paiement Mobile Money n’a pas abouti.'));
        ref = settled.operatorReference ?? started.id;
      }
      const session = await marketSession();
      if (!session) throw new Error(t('Votre session a expiré. Reconnectez-vous.'));
      await requestAction(session, paying.id, 'pay', { method, payment_ref: ref });
      setPaying(null);
      await refresh();
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : 'Paiement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const canPay = !!method && authorized && (!methodNeedsPhone(method) || isCompleteNumber(payPhone, payCountry));

  return (
    <View style={styles.root}>
      <Text style={o.sectionTitle}>{t('Demandes en ligne')}</Text>
      {!!error && <Text style={o.error}>{error}</Text>}
      {!!actionError && <Text style={o.error}>{actionError}</Text>}
      {requests.map((r) => {
        const expired = isExpired(r);
        const trade = t(getTrade(r.tradeId)?.label ?? r.tradeId);
        return (
          <View key={r.id} style={o.card}>
            <View style={o.head}>
              <View style={o.headBody}>
                <Text style={o.name}>{trade}</Text>
                <Text style={o.sub}>{t(r.slot)}</Text>
              </View>
              <View style={o.chip}>
                <Text style={o.chipText}>{t(requestStatusLabel(r))}</Text>
              </View>
            </View>
            {!!r.description && <Text style={o.body}>{r.description}</Text>}
            <Text style={o.amount}>{formatAmount(r.amount, r.currency)}</Text>

            {r.status === 'draft' && (
              <View style={o.actions}>
                <Pressable onPress={() => act(r, 'cancel')} accessibilityRole="button" accessibilityLabel={t('Annuler la demande en ligne')} style={o.ghost}>
                  <Text style={o.ghostLabel}>{t('Annuler')}</Text>
                </Pressable>
                <Pressable onPress={() => openPay(r)} accessibilityRole="button" accessibilityLabel={t('Revoir et payer la demande en ligne')} style={o.solid}>
                  <Text style={o.solidLabel}>{t('Revoir et payer')}</Text>
                </Pressable>
              </View>
            )}

            {r.status === 'sent' && !expired && (
              <>
                <Text style={o.line}>
                  {t('Réponse attendue avant')}{' '}
                  {r.responseDeadline ? new Date(r.responseDeadline).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''}.
                </Text>
                <View style={o.actions}>
                  <Pressable onPress={() => act(r, 'cancel')} accessibilityRole="button" accessibilityLabel={t('Annuler la demande en ligne')} style={o.ghost}>
                    <Text style={o.ghostLabel}>{t('Annuler · remboursé')}</Text>
                  </Pressable>
                  <Pressable onPress={() => setChat(r)} accessibilityRole="button" accessibilityLabel={t('Ouvrir le chat de la demande')} style={o.solid}>
                    <Text style={o.solidLabel}>{t('Message')}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {(r.status === 'refused' || expired) && (
              <>
                <Text style={o.line}>{t("Le prestataire n'a pas accepté. Vos fonds restent protégés : choisissez un autre prestataire qualifié ou demandez le remboursement intégral.")}</Text>
                <View style={o.actions}>
                  <Pressable onPress={() => act(r, 'cancel')} accessibilityRole="button" accessibilityLabel={t('Demander le remboursement de la demande en ligne')} style={o.ghost}>
                    <Text style={o.ghostLabel}>{t('Remboursement')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      await act(r, 'cancel');
                      navigation.navigate('Accueil');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('Choisir un autre prestataire')}
                    style={o.solid}
                  >
                    <Text style={o.solidLabel}>{t('Autre prestataire')}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {r.status === 'accepted' && (
              <>
                <StageTracker request={r} />
                <View style={o.actions}>
                  <Pressable onPress={() => setChat(r)} accessibilityRole="button" accessibilityLabel={t('Ouvrir le chat de la demande')} style={o.ghost}>
                    <Text style={o.ghostLabel}>{t('Message')}</Text>
                  </Pressable>
                  {r.stage === 'completed' ? (
                    <Pressable onPress={() => act(r, 'validate')} accessibilityRole="button" accessibilityLabel={t('Valider et débloquer les fonds')} style={o.solid}>
                      <Text style={o.solidLabel}>{t('Valider')}</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => act(r, 'cancel')} accessibilityRole="button" accessibilityLabel={t('Annuler la mission en ligne')} style={o.ghost}>
                      <Text style={o.ghostLabel}>{t('Annuler (remboursement après examen)')}</Text>
                    </Pressable>
                  )}
                </View>
                {r.stage === 'completed' && (
                  <>
                    <Text style={o.line}>
                      {t('Le prestataire recevra')} {formatAmount(settle(r.amount, 'standard').net, r.currency)}{' '}
                      {t('après commission et frais de versement.')}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setDisputing(r);
                        setReason(null);
                        setOutcome(null);
                        setDetails('');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('Signaler un problème sur la demande en ligne')}
                      style={styles.link}
                    >
                      <Text style={styles.linkLabel}>{t('Signaler un problème')}</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}

            {r.status === 'disputed' && (
              <Text style={o.line}>{t("Fonds gelés pendant l'examen. 242Konnect examine le contrat, le chat, les horaires et les preuves ; le prestataire peut répondre. Aucun remboursement n'est promis avant cette décision.")}</Text>
            )}
            {r.status === 'cancelled' && (
              <Text style={o.line}>
                {r.refundStatus === 'under_review'
                  ? t("Annulée après acceptation : le remboursement est calculé selon le préavis et le travail effectué, après examen par 242Konnect. Les fonds restent bloqués d'ici là.")
                  : r.refundStatus === 'full'
                    ? t('Remboursée intégralement.')
                    : t('Annulée avant paiement : rien n’a été débité.')}
              </Text>
            )}
          </View>
        );
      })}

      {/* Commande §04–§06: review, method by country, policy, authorisation. */}
      <Sheet visible={!!paying} title={t('Revoir et payer')} onClose={() => setPaying(null)}>
        {paying && (
          <View style={styles.form}>
            <View style={styles.recap}>
              <Text style={o.sectionTitle}>{t('Récapitulatif de la commande')}</Text>
              <Line label={t('Service')} value={t(getTrade(paying.tradeId)?.label ?? paying.tradeId)} />
              <Line label={t('Horaire')} value={t(paying.slot)} />
              {!!payAddress && <Line label={t('Adresse')} value={payAddress} />}
              <Line label={t('Prix de la prestation')} value={formatAmount(paying.amount, paying.currency)} />
              <Line label={t('Frais de protection 242Konnect')} value={formatAmount(0, paying.currency)} />
              <Line label={t('Total autorisé')} value={formatAmount(paying.amount, paying.currency)} strong />
            </View>
            <Text style={o.sectionTitle}>{t('Moyen de paiement')}</Text>
            {methods.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMethod(m.id)}
                accessibilityRole="button"
                accessibilityLabel={m.label}
                aria-selected={method === m.id}
                style={[styles.method, method === m.id && styles.methodOn]}
              >
                <Text style={styles.methodLabel}>{m.label}</Text>
              </Pressable>
            ))}
            {methodNeedsPhone(method) && (
              <PhoneField
                value={payPhone}
                onChangeText={setPayPhone}
                country={payCountry}
                onCountryChange={setPayCountry}
                label={t('Numéro Mobile Money')}
              />
            )}
            <Text style={o.line}>{t('Avant acceptation : remboursement intégral. Après acceptation : selon le préavis et le travail effectué, après examen. Refus ou absence de réponse sous 24 h : autre prestataire ou remboursement intégral.')}</Text>
            <Pressable
              onPress={() => setAuthorized((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityLabel={t("J'autorise le paiement")}
              aria-checked={authorized}
              style={styles.auth}
            >
              <View style={[styles.box, authorized && styles.boxOn]}>
                {authorized && <Icon name="242k:check" size={14} color={colors.accentForeground} />}
              </View>
              <Text style={styles.authLabel}>
                {t("J'autorise 242Konnect à prélever")} {formatAmount(paying.amount, paying.currency)}{' '}
                {t("et à les conserver jusqu'à ma validation.")}
              </Text>
            </Pressable>
            {!!sheetError && <Text style={o.error}>{sheetError}</Text>}
            <Pressable
              onPress={confirmPay}
              disabled={!canPay || busy}
              accessibilityRole="button"
              accessibilityLabel={t('Confirmer le paiement en ligne')}
              style={[styles.wide, (!canPay || busy) && o.solidOff]}
            >
              {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={o.solidLabel}>{t('Payer et envoyer la demande')}</Text>}
            </Pressable>
          </View>
        )}
      </Sheet>

      <Sheet visible={!!disputing} title={t('Signaler un problème')} onClose={() => setDisputing(null)}>
        <View style={styles.form}>
          <Text style={o.line}>{t("Le paiement reste bloqué pendant l'examen. 242Konnect examine le contrat, le chat, les horaires et les preuves, et le prestataire peut répondre.")}</Text>
          <Text style={o.sectionTitle}>{t('Motif')}</Text>
          <View style={styles.chips}>
            {DISPUTE_REASONS.map((x) => (
              <Pressable key={x} onPress={() => setReason(x)} accessibilityRole="radio" accessibilityLabel={t(x)} aria-selected={reason === x} style={[styles.choice, reason === x && styles.choiceOn]}>
                <Text style={styles.choiceLabel}>{t(x)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={o.sectionTitle}>{t('Ce que vous demandez')}</Text>
          <View style={styles.chips}>
            {OUTCOMES.map((x) => (
              <Pressable key={x.id} onPress={() => setOutcome(x.id)} accessibilityRole="radio" accessibilityLabel={t(x.label)} aria-selected={outcome === x.id} style={[styles.choice, outcome === x.id && styles.choiceOn]}>
                <Text style={styles.choiceLabel}>{t(x.label)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={details}
            onChangeText={setDetails}
            multiline
            placeholder={t("Décrivez ce qui s'est passé")}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t('Détails du problème')}
            style={styles.textarea}
          />
          <Pressable
            onPress={async () => {
              if (!disputing || !reason || !outcome) return;
              await act(disputing, 'dispute', { reason, outcome, details: details.trim() });
              setDisputing(null);
            }}
            disabled={!reason || !outcome}
            accessibilityRole="button"
            accessibilityLabel={t('Envoyer le signalement')}
            style={[styles.wide, (!reason || !outcome) && o.solidOff]}
          >
            <Text style={o.solidLabel}>{t('Envoyer le signalement')}</Text>
          </Pressable>
        </View>
      </Sheet>

      <RequestChatSheet request={chat} title={t('Chat de la demande')} onClose={() => setChat(null)} />
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  form: { gap: 10 },
  recap: {
    padding: 12,
    gap: 4,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  lineValue: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  strong: { fontFamily: fonts.sansBold, color: colors.foreground },
  method: { padding: 14, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  methodOn: { borderColor: colors.foreground, backgroundColor: colors.muted },
  methodLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  auth: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 19, color: colors.foreground },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  // Not o.solid: its flex: 1 (basis 0) collapses a full-width button in a column.
  wide: {
    height: 52,
    marginTop: 4,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  textarea: {
    minHeight: 80,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
  link: { alignSelf: 'center', paddingVertical: 4 },
  linkLabel: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.mutedForeground, textDecorationLine: 'underline' },
});
