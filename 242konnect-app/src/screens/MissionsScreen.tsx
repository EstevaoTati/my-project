import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ProAvatar } from '../components/Avatar';
import { Sheet } from '../components/Sheet';
import { PhoneField } from '../components/form';
import { formatFcfaFull, getProfessional, professionalTrade } from '../data';
import {
  COMMISSION_RATE,
  methodNeedsPhone,
  PAYMENT_METHODS,
  paymentMethodLabel,
  PAYOUT_EXPRESS_RATE,
  PAYOUT_STANDARD_DELAY_DAYS,
  PAYOUT_STANDARD_RATE,
  settle,
  type PaymentMethod,
  type PayoutSpeed,
  type Settlement,
} from '../payments';
import {
  failureMessage,
  momoGatewayConfigured,
  operatorForPhone,
  OPERATOR_LABELS,
  PIN_PROMPT_TIMEOUT_SECONDS,
  pollCollection,
  requestToPay,
} from '../momo';
import { useStore, type Booking, type MissionStatus } from '../store';
import { formatPhone, normalizePhone, useAuth } from '../auth';
import { colors, fonts, radius, shadow } from '../theme';

const STATUS: Record<MissionStatus, { label: string; bg: string; fg: string }> = {
  confirmee: { label: 'À payer', bg: colors.warningSurface, fg: colors.warning },
  payee: { label: 'Fonds bloqués', bg: colors.muted, fg: colors.foreground },
  validee: { label: 'Validée', bg: colors.successSurface, fg: colors.success },
  litige: { label: 'Litige', bg: colors.destructiveSurface, fg: colors.destructive },
  annulee: { label: 'Annulée', bg: colors.muted, fg: colors.mutedForeground },
};

const pct = (r: number) => `${(r * 100).toLocaleString('fr-FR')} %`;

export function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, payments, payBooking, cancelBooking, validateMission, disputeMission, totalPaid, heldInEscrow } =
    useStore();
  const { account } = useAuth();

  const [paying, setPaying] = useState<Booking | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [payPhone, setPayPhone] = useState(account?.phone ?? '');
  const [receipt, setReceipt] = useState<{
    reference: string;
    amount: number;
    method: PaymentMethod;
    operatorReference?: string;
    simulated: boolean;
  } | null>(null);

  /**
   * Mobile Money runs asynchronously: we ask the operator to prompt the payer,
   * then wait. `momoPhase` is what the sheet renders while that happens, and
   * `momoAbort` lets the payer give up without leaving a poll running.
   */
  const [momoPhase, setMomoPhase] = useState<'idle' | 'prompting' | 'waiting'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(PIN_PROMPT_TIMEOUT_SECONDS);
  const [payError, setPayError] = useState<string | null>(null);
  const momoAbort = useRef<AbortController | null>(null);

  const [validating, setValidating] = useState<Booking | null>(null);
  const [speed, setSpeed] = useState<PayoutSpeed>('standard');
  const [settled, setSettled] = useState<Settlement | null>(null);

  const openPayment = (booking: Booking) => {
    setPaying(booking);
    setMethod(null);
    setReceipt(null);
    setPayError(null);
    setMomoPhase('idle');
    setPayPhone(account?.phone ?? '');
  };

  /** Abandons any in-flight collection; called on close and on "Annuler". */
  const stopMomo = () => {
    momoAbort.current?.abort();
    momoAbort.current = null;
    setMomoPhase('idle');
  };

  const closePayment = () => {
    stopMomo();
    setPaying(null);
  };

  const confirmPayment = async () => {
    if (!paying || !method) return;
    setPayError(null);

    // Card and transfer stay a single step; only Mobile Money has the PIN round trip.
    if (method !== 'mtn' && method !== 'airtel') {
      const payment = payBooking(paying.id, method, paying.rate);
      setReceipt({
        reference: payment.reference,
        amount: payment.amount,
        method,
        simulated: true,
      });
      return;
    }

    const phone = normalizePhone(payPhone);
    const controller = new AbortController();
    momoAbort.current = controller;

    try {
      setMomoPhase('prompting');
      const started = await requestToPay({
        operator: method,
        phone,
        amount: paying.rate,
        label: `242Konnect · mission ${paying.id.slice(0, 6).toUpperCase()}`,
      });

      setMomoPhase('waiting');
      setSecondsLeft(PIN_PROMPT_TIMEOUT_SECONDS);
      const settledCollection = await pollCollection(started.id, phone, {
        signal: controller.signal,
        onTick: setSecondsLeft,
      });

      if (settledCollection.status !== 'successful') {
        setMomoPhase('idle');
        setPayError(failureMessage(settledCollection));
        return;
      }

      // Only now has money actually moved.
      const payment = payBooking(paying.id, method, paying.rate, {
        operatorReference: settledCollection.operatorReference,
        payerPhone: phone,
      });
      setMomoPhase('idle');
      setReceipt({
        reference: payment.reference,
        amount: payment.amount,
        method,
        operatorReference: settledCollection.operatorReference,
        simulated: settledCollection.simulated,
      });
    } catch (e) {
      setMomoPhase('idle');
      // An abort is the payer's own doing, so it is not an error to report.
      if (!controller.signal.aborted)
        setPayError(e instanceof Error ? e.message : 'Le paiement a échoué.');
    } finally {
      momoAbort.current = null;
    }
  };

  const openValidation = (booking: Booking) => {
    setValidating(booking);
    setSpeed('standard');
    setSettled(null);
  };

  const confirmValidation = () => {
    if (!validating) return;
    setSettled(validateMission(validating.id, speed) ?? null);
  };

  const canPay = !!method && (!methodNeedsPhone(method) || normalizePhone(payPhone).length === 9);

  /**
   * The operator the entered number looks like, when that disagrees with the one
   * selected. Paying from an Airtel line with MTN selected is the single most
   * common mobile money failure, and the operator's own error for it is opaque.
   */
  const detected = operatorForPhone(payPhone);
  const operatorMismatch =
    (method === 'mtn' || method === 'airtel') && detected && detected !== method ? detected : null;

  const preview = validating ? settle(validating.rate, speed) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Missions</Text>
        {(totalPaid > 0 || heldInEscrow > 0) && (
          <Text style={styles.subtitle}>
            {formatFcfaFull(totalPaid)} FCFA payés
            {heldInEscrow > 0 ? ` · ${formatFcfaFull(heldInEscrow)} FCFA en attente de validation` : ''}
          </Text>
        )}
      </View>

      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="solar:calendar-mark-linear" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>Aucune mission</Text>
          <Text style={styles.emptyBody}>
            Réservez un prestataire depuis son profil : la mission apparaîtra ici, avec le paiement.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* §2.2 and §6.4, stated once at the top rather than buried: the money
              never goes directly to the prestataire. */}
          <View style={styles.rule}>
            <Icon name="solar:shield-check-bold" size={18} color={colors.foreground} />
            <Text style={styles.ruleText}>
              Tous les paiements passent par 242Konnect. Ne remettez jamais d'argent directement au
              prestataire, même en pourboire.
            </Text>
          </View>

          {bookings.map((booking) => {
            const pro = getProfessional(booking.professionalId);
            if (!pro) return null;
            const status = STATUS[booking.status];
            const payment = payments.find((p) => p.id === booking.paymentId);
            return (
              <View key={booking.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <ProAvatar professional={pro} size={48} rounded={24} />
                  <View style={styles.cardIdentity}>
                    <Text style={styles.cardName}>{pro.name}</Text>
                    <Text style={styles.cardTrade}>{professionalTrade(pro)?.label ?? ''}</Text>
                  </View>
                  <View style={[styles.status, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusLabel, { color: status.fg }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.meta}>
                  <View style={styles.metaRow}>
                    <Icon name="solar:calendar-mark-linear" size={16} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{booking.slot}</Text>
                  </View>
                  <Text style={styles.rate}>{formatFcfaFull(booking.rate)} FCFA</Text>
                </View>

                {booking.status === 'payee' && (
                  <Text style={styles.escrowLine}>
                    242Konnect conserve {formatFcfaFull(booking.rate)} FCFA jusqu'à votre validation.
                    {payment ? ` Réf. ${payment.reference}.` : ''}
                  </Text>
                )}

                {booking.status === 'validee' && booking.settlement && (
                  <View style={styles.breakdown}>
                    <Text style={styles.breakdownTitle}>Répartition</Text>
                    <Row label="Montant de la prestation" value={booking.settlement.total} />
                    <Row label={`Commission 242Konnect (${pct(COMMISSION_RATE)})`} value={-booking.settlement.commission} />
                    <Row
                      label={`Frais de versement (${pct(booking.settlement.speed === 'express' ? PAYOUT_EXPRESS_RATE : PAYOUT_STANDARD_RATE)})`}
                      value={-booking.settlement.payoutFee}
                    />
                    <Row label="Versé au prestataire" value={booking.settlement.net} strong />
                    <Text style={styles.breakdownNote}>
                      {booking.settlement.speed === 'express'
                        ? 'Versement express, immédiat.'
                        : `Versement sous ${booking.settlement.delayDays} jours.`}
                    </Text>
                  </View>
                )}

                {booking.status === 'litige' && (
                  <Text style={styles.disputeLine}>
                    Les fonds restent bloqués jusqu'à la décision de 242Konnect.
                  </Text>
                )}

                {booking.status === 'confirmee' && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => cancelBooking(booking.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Annuler la mission avec ${pro.name}`}
                      style={styles.ghost}
                    >
                      <Text style={styles.ghostLabel}>Annuler</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openPayment(booking)}
                      accessibilityRole="button"
                      accessibilityLabel={`Payer la mission avec ${pro.name}`}
                      style={styles.solid}
                    >
                      <Text style={styles.solidLabel}>Payer</Text>
                    </Pressable>
                  </View>
                )}

                {booking.status === 'payee' && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => disputeMission(booking.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Signaler un problème sur la mission avec ${pro.name}`}
                      style={styles.ghost}
                    >
                      <Text style={styles.ghostLabel}>Signaler un problème</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openValidation(booking)}
                      accessibilityRole="button"
                      accessibilityLabel={`Valider la prestation de ${pro.name}`}
                      style={styles.solid}
                    >
                      <Text style={styles.solidLabel}>Valider</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ---- Payment ---- */}
      <Sheet
        visible={!!paying}
        title={
          receipt
            ? 'Paiement enregistré'
            : momoPhase !== 'idle'
              ? 'Confirmez sur votre téléphone'
              : 'Payer la mission'
        }
        onClose={closePayment}
      >
        {momoPhase !== 'idle' && !receipt ? (
          /* The operator has the payer's attention now, not us. This state exists
             so the wait is legible instead of looking like a frozen button. */
          <View style={styles.done}>
            <ActivityIndicator size="large" color={colors.foreground} />
            <Text style={styles.doneTitle}>
              {method ? OPERATOR_LABELS[method as 'mtn' | 'airtel'] : ''}
            </Text>
            <Text style={styles.doneBody}>
              {momoPhase === 'prompting'
                ? 'Envoi de la demande à votre opérateur…'
                : `Une demande de paiement de ${formatFcfaFull(paying?.rate ?? 0)} FCFA a été envoyée au ${formatPhone(normalizePhone(payPhone))}. Saisissez votre code PIN Mobile Money pour confirmer.`}
            </Text>
            {momoPhase === 'waiting' && (
              <Text style={styles.countdown}>{secondsLeft} s restantes</Text>
            )}
            <Pressable
              onPress={stopMomo}
              accessibilityRole="button"
              accessibilityLabel="Annuler le paiement"
              style={styles.ghostWide}
            >
              <Text style={styles.ghostLabel}>Annuler</Text>
            </Pressable>
          </View>
        ) : receipt ? (
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Icon name="solar:shield-check-bold" size={32} color={colors.foreground} />
            </View>
            <Text style={styles.doneTitle}>{formatFcfaFull(receipt.amount)} FCFA</Text>
            <Text style={styles.doneBody}>
              {paymentMethodLabel(receipt.method)} · référence {receipt.reference}
              {receipt.operatorReference ? `\nTransaction opérateur ${receipt.operatorReference}` : ''}
            </Text>
            <Text style={styles.doneEscrow}>
              242Konnect conserve ce montant. Le prestataire ne sera payé qu'après votre validation
              de la prestation.
            </Text>
            {receipt.simulated && (
              <Text style={styles.demoNote}>
                Démonstration : aucun argent n'a été débité. Les paiements réels nécessitent les
                comptes marchands MTN MoMo et Airtel Money côté serveur.
              </Text>
            )}
            <Pressable onPress={closePayment} accessibilityRole="button" style={styles.solidWide}>
              <Text style={styles.solidLabel}>Terminé</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sheetAmount}>
              {paying ? formatFcfaFull(paying.rate) : 0} <Text style={styles.sheetCurrency}>FCFA</Text>
            </Text>
            <Text style={styles.sheetEscrow}>
              Vous payez 242Konnect maintenant. Le prestataire se met en route une fois le paiement
              confirmé, et n'est payé qu'après votre validation.
            </Text>

            <Text style={styles.sheetHint}>Moyen de paiement</Text>
            {PAYMENT_METHODS.map((m) => {
              const selected = method === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMethod(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected }}
                  style={[styles.method, selected && styles.methodSelected]}
                >
                  <View style={styles.methodBody}>
                    <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>{m.label}</Text>
                    <Text style={styles.methodHint}>{m.hint}</Text>
                  </View>
                  {selected && <Icon name="solar:shield-check-bold" size={20} color={colors.foreground} />}
                </Pressable>
              );
            })}

            {methodNeedsPhone(method) && (
              <View style={styles.payPhone}>
                <PhoneField value={payPhone} onChangeText={setPayPhone} />
                <Text style={styles.payPhoneHint}>
                  Le numéro du compte Mobile Money à débiter. Vous recevrez une demande de code PIN
                  sur ce téléphone.
                </Text>
                {/* A warning, not a block: number portability and prefix
                    reallocations both mean the customer knows their own line
                    better than our table does. */}
                {operatorMismatch && (
                  <Text style={styles.payPhoneWarn}>
                    Ce numéro ressemble à un numéro {OPERATOR_LABELS[operatorMismatch]}. Vérifiez
                    l'opérateur sélectionné avant de continuer.
                  </Text>
                )}
              </View>
            )}

            {payError && (
              <View style={styles.payError}>
                <Text style={styles.payErrorText}>{payError}</Text>
              </View>
            )}

            <Pressable
              onPress={confirmPayment}
              disabled={!canPay}
              accessibilityRole="button"
              accessibilityLabel="Confirmer le paiement"
              accessibilityState={{ disabled: !canPay }}
              style={[styles.solidWide, !canPay && styles.solidOff]}
            >
              <Text style={styles.solidLabel}>
                {method === 'mtn' || method === 'airtel'
                  ? `Payer avec ${OPERATOR_LABELS[method]}`
                  : 'Payer à 242Konnect'}
              </Text>
            </Pressable>

            {!momoGatewayConfigured && (method === 'mtn' || method === 'airtel') && (
              <Text style={styles.demoNote}>
                Démonstration : le parcours complet est joué (demande, code PIN, confirmation) mais
                aucun argent n'est débité tant que les comptes marchands ne sont pas connectés.
              </Text>
            )}
          </>
        )}
      </Sheet>

      {/* ---- Validation and settlement ---- */}
      <Sheet
        visible={!!validating}
        title={settled ? 'Prestation validée' : 'Valider la prestation'}
        onClose={() => setValidating(null)}
      >
        {settled ? (
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Icon name="solar:shield-check-bold" size={32} color={colors.success} />
            </View>
            <Text style={styles.doneTitle}>{formatFcfaFull(settled.net)} FCFA</Text>
            <Text style={styles.doneBody}>
              versés au prestataire{settled.speed === 'express' ? ' immédiatement' : ` sous ${settled.delayDays} jours`}
            </Text>
            <Text style={styles.demoNote}>
              Démonstration : aucun versement réel n'a lieu.
            </Text>
            <Pressable onPress={() => setValidating(null)} accessibilityRole="button" style={styles.solidWide}>
              <Text style={styles.solidLabel}>Terminé</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sheetEscrow}>
              En validant, vous confirmez que la prestation a été réalisée. Les fonds sont alors
              débloqués et versés au prestataire.
            </Text>

            <Text style={styles.sheetHint}>Mode de versement au prestataire</Text>
            {(['standard', 'express'] as PayoutSpeed[]).map((option) => {
              const selected = speed === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSpeed(option)}
                  accessibilityRole="button"
                  accessibilityLabel={option === 'standard' ? 'Versement standard' : 'Versement express'}
                  accessibilityState={{ selected }}
                  style={[styles.method, selected && styles.methodSelected]}
                >
                  <View style={styles.methodBody}>
                    <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>
                      {option === 'standard' ? 'Standard' : 'Express'}
                    </Text>
                    <Text style={styles.methodHint}>
                      {option === 'standard'
                        ? `Sous ${PAYOUT_STANDARD_DELAY_DAYS} jours · frais ${pct(PAYOUT_STANDARD_RATE)}`
                        : `Immédiat · frais ${pct(PAYOUT_EXPRESS_RATE)}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}

            {preview && (
              <View style={styles.breakdown}>
                <Row label="Montant de la prestation" value={preview.total} />
                <Row label={`Commission 242Konnect (${pct(COMMISSION_RATE)})`} value={-preview.commission} />
                <Row
                  label={`Frais de versement (${pct(speed === 'express' ? PAYOUT_EXPRESS_RATE : PAYOUT_STANDARD_RATE)})`}
                  value={-preview.payoutFee}
                />
                <Row label="Versé au prestataire" value={preview.net} strong />
              </View>
            )}

            <Pressable
              onPress={confirmValidation}
              accessibilityRole="button"
              accessibilityLabel="Confirmer la validation"
              style={styles.solidWide}
            >
              <Text style={styles.solidLabel}>Valider et débloquer les fonds</Text>
            </Pressable>
          </>
        )}
      </Sheet>
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>
        {value < 0 ? '−' : ''}
        {formatFcfaFull(Math.abs(value))} FCFA
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  subtitle: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  list: { padding: 20, paddingTop: 4, gap: 14 },
  rule: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 18, color: colors.foreground },
  card: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIdentity: { flex: 1 },
  cardName: { fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  cardTrade: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.lg },
  statusLabel: { fontFamily: fonts.sansBold, fontSize: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  rate: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  escrowLine: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  disputeLine: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 18, color: colors.destructive },
  breakdown: {
    padding: 12,
    gap: 4,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  breakdownTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  breakdownNote: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  rowValue: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground, fontVariant: ['tabular-nums'] },
  rowStrong: { fontFamily: fonts.sansBold, color: colors.foreground },
  actions: { flexDirection: 'row', gap: 10 },
  ghost: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.mutedForeground },
  solid: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidWide: {
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  solidOff: { backgroundColor: colors.mutedForeground, opacity: 0.5 },
  solidLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryForeground },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, paddingBottom: 120 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
  },
  sheetAmount: { fontFamily: fonts.headingBold, fontSize: 30, color: colors.foreground },
  sheetCurrency: { fontSize: 16, color: colors.mutedForeground },
  sheetEscrow: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    marginTop: 8,
    marginBottom: 12,
  },
  sheetHint: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground, marginBottom: 8 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  methodSelected: { borderColor: colors.foreground, backgroundColor: colors.muted },
  methodBody: { flex: 1 },
  methodLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  methodLabelSelected: { color: colors.foreground },
  methodHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  payPhone: { marginBottom: 12 },
  payPhoneHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedForeground,
    marginTop: 6,
  },
  payPhoneWarn: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.warning,
    marginTop: 6,
  },
  payError: {
    padding: 12,
    marginBottom: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.destructiveSurface,
    borderWidth: 1,
    borderColor: 'rgba(185,28,28,0.22)',
  },
  payErrorText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.destructive,
  },
  countdown: {
    fontFamily: fonts.headingBold,
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  ghostWide: {
    height: 52,
    marginTop: 4,
    alignSelf: 'stretch',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { alignItems: 'center', gap: 8 },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontFamily: fonts.headingBold, fontSize: 26, color: colors.foreground },
  doneBody: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  doneEscrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.foreground,
    textAlign: 'center',
    marginTop: 4,
  },
  demoNote: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.warning,
    textAlign: 'center',
    marginTop: 4,
  },
});
