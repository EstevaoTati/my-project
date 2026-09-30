import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import {
  LONG_DURATIONS,
  RESPONSE_DELAY_HOURS,
  STAGES,
  useStore,
  VALIDATION_DELAY_HOURS,
  type Booking,
  type Dispute,
  type MissionDuration,
  type MissionStage,
  type MissionStatus,
  type Payment,
} from '../store';
import { useNavigation } from '@react-navigation/native';
import { downloadReceipt } from '../receipt';
import { pickAvatar } from '../photo';
import { formatStored, useAuth } from '../auth';
import {
  DEFAULT_COUNTRY,
  formatNational,
  fromE164,
  isCompleteNumber,
  normalizeNational,
  type CountryCode,
} from '../countries';
import { colors, fonts, radius, shadow } from '../theme';
import { T, useT } from '../i18n';

const STATUS: Record<MissionStatus, { label: string; bg: string; fg: string }> = {
  demandee: { label: T('À payer'), bg: colors.warningSurface, fg: colors.warning },
  payee: { label: T('Envoyée · fonds bloqués'), bg: colors.muted, fg: colors.foreground },
  refusee: { label: T('Non acceptée'), bg: colors.warningSurface, fg: colors.warning },
  acceptee: { label: T('Acceptée'), bg: colors.successSurface, fg: colors.success },
  validee: { label: T('Validée'), bg: colors.successSurface, fg: colors.success },
  litige: { label: T('Litige'), bg: colors.destructiveSurface, fg: colors.destructive },
  annulee: { label: T('Annulée'), bg: colors.muted, fg: colors.mutedForeground },
};

/** Commande §08: Accepted, On the way, Arrived, Work in progress, Completed. */
const STAGE_LABELS: Record<MissionStage, string> = {
  accepted: T('Acceptée'),
  on_the_way: T('En route'),
  arrived: T('Arrivé'),
  in_progress: T('En cours'),
  completed: T('Terminée'),
};

const DURATION_LABELS: Record<MissionDuration, string> = {
  hours: T('Quelques heures'),
  days: T('Quelques jours'),
  weeks: T('Quelques semaines'),
  months: T('Plusieurs mois'),
  recurring: T('Service récurrent'),
};

/** Client §14: "My jobs distingue Active, Completed et Cancelled." */
type Filter = 'active' | 'completed' | 'cancelled';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'active', label: T('Actives') },
  { id: 'completed', label: T('Terminées') },
  { id: 'cancelled', label: T('Annulées') },
];
const inFilter = (b: Booking, f: Filter) =>
  f === 'completed' ? b.status === 'validee' : f === 'cancelled' ? b.status === 'annulee' : b.status !== 'validee' && b.status !== 'annulee';

const DISPUTE_REASONS = [
  T('Travail non conforme'),
  T('Travail incomplet'),
  T('Prestataire absent'),
  T('Dommages'),
  T('Autre'),
];
const DISPUTE_OUTCOMES: { id: Dispute['outcome']; label: string }[] = [
  { id: 'redo', label: T('Reprise du travail') },
  { id: 'partial_refund', label: T('Remboursement partiel') },
  { id: 'full_refund', label: T('Remboursement complet') },
];

/** Protection fee charged to the client — zero: the 12 % is taken from the payout. */
const PROTECTION_FEE = 0;

const pct = (r: number) => `${(r * 100).toLocaleString('fr-FR')} %`;

export function MissionsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const {
    bookings, payments, payBooking, cancelBooking, validateMission, disputeMission,
    acceptBooking, refuseBooking, advanceStage, reviewMission, totalPaid, heldInEscrow,
    ensureThread,
  } = useStore();
  const { account } = useAuth();
  // Untyped on purpose: this screen jumps across tabs (Messages, Accueil),
  // which the tab navigator's own param list does not describe.
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const [filter, setFilter] = useState<Filter>('active');
  const [authorized, setAuthorized] = useState(false);

  const [disputing, setDisputing] = useState<Booking | null>(null);
  const [disputeReason, setDisputeReason] = useState<string | null>(null);
  const [disputeOutcome, setDisputeOutcome] = useState<Dispute['outcome'] | null>(null);
  const [disputeDetails, setDisputeDetails] = useState('');
  const [disputePhoto, setDisputePhoto] = useState<string | undefined>();

  // §05: the verified country decides the methods on offer. Mobile Money is a
  // Congolese rail; in the United States, card and bank only.
  const methods = PAYMENT_METHODS.filter((m) =>
    account?.location.country === 'US' ? m.id === 'carte' || m.id === 'virement' : true
  );
  const visible = bookings.filter((b) => inFilter(b, filter));

  const openChat = (professionalId: string) => {
    ensureThread(professionalId);
    navigation.navigate('Messages', { screen: 'Discussion', params: { id: professionalId }, initial: false });
  };

  const openDispute = (booking: Booking) => {
    setDisputing(booking);
    setDisputeReason(null);
    setDisputeOutcome(null);
    setDisputeDetails('');
    setDisputePhoto(undefined);
  };

  const submitDispute = () => {
    if (!disputing || !disputeReason || !disputeOutcome) return;
    disputeMission(disputing.id, {
      reason: disputeReason,
      outcome: disputeOutcome,
      details: disputeDetails.trim(),
      photo: disputePhoto,
    });
    setDisputing(null);
  };

  const [paying, setPaying] = useState<Booking | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [payPhone, setPayPhone] = useState(
    account ? fromE164(account.phone).national : ''
  );
  const [payCountry, setPayCountry] = useState<CountryCode>(account?.phoneCountry ?? DEFAULT_COUNTRY);
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

  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState<string | undefined>();
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [validating, setValidating] = useState<Booking | null>(null);
  const [speed, setSpeed] = useState<PayoutSpeed>('standard');
  const [settled, setSettled] = useState<Settlement | null>(null);

  const openPayment = (booking: Booking) => {
    setPaying(booking);
    setMethod(null);
    setReceipt(null);
    setPayError(null);
    setMomoPhase('idle');
    setAuthorized(false);
    setPayPhone(account ? fromE164(account.phone).national : '');
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

    const phone = normalizeNational(payPhone, payCountry);
    const controller = new AbortController();
    momoAbort.current = controller;

    try {
      setMomoPhase('prompting');
      const started = await requestToPay({
        operator: method,
        phone,
        amount: paying.rate,
        label: `242Konnect · mission ${paying.id.slice(0, 6).toUpperCase()}`,
        idempotencyKey: paying.idempotencyKey,
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

  const openReview = (booking: Booking) => {
    setReviewing(booking);
    setRating(5);
    setComment('');
    setReviewPhoto(undefined);
    setReviewError(null);
  };

  const addReviewPhoto = async () => {
    setReviewError(null);
    try {
      // Same bounded pipeline as avatars: an unbounded photo here would refill
      // the storage the avatar fix just emptied.
      const next = await pickAvatar();
      if (next) setReviewPhoto(next);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Impossible d'ajouter cette photo.");
    }
  };

  const submitReview = () => {
    if (!reviewing) return;
    reviewMission(reviewing.id, { rating, comment: comment.trim(), photo: reviewPhoto });
    setReviewing(null);
  };

  /** Builds the receipt for a paid mission and hands it to the person. */
  const shareReceipt = async (booking: Booking, payment: Payment, pro: { name: string }) => {
    await downloadReceipt({
      booking,
      payment,
      professionalName: pro.name,
      tradeLabel: professionalTrade(getProfessional(booking.professionalId)!)?.label ?? '',
      clientName: account?.name ?? '',
      clientPhone: account ? formatStored(account.phone) : '',
    });
  };

  const openValidation = (booking: Booking) => {
    setValidating(booking);
    setSpeed('standard');
    setSettled(null);
  };

  const confirmValidation = () => {
    if (!validating) return;
    const result = validateMission(validating.id, speed) ?? null;
    setSettled(result);
    // The mission now belongs under "Terminées"; follow it there, so the
    // review and the receipt it offers are on screen rather than filtered out.
    if (result) setFilter('completed');
  };

  const canPay =
    !!method && authorized && (!methodNeedsPhone(method) || isCompleteNumber(payPhone, payCountry));

  /**
   * The operator the entered number looks like, when that disagrees with the one
   * selected. Paying from an Airtel line with MTN selected is the single most
   * common mobile money failure, and the operator's own error for it is opaque.
   */
  // Operator prefixes are a Congolese notion; a US number has no MTN/Airtel line.
  const detected = payCountry === 'CG' ? operatorForPhone(payPhone) : null;
  const operatorMismatch =
    (method === 'mtn' || method === 'airtel') && detected && detected !== method ? detected : null;

  const preview = validating ? settle(validating.rate, speed) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>{t('Missions')}</Text>
        {(totalPaid > 0 || heldInEscrow > 0) && (
          <Text style={styles.subtitle}>
            {formatFcfaFull(totalPaid)} FCFA payés
            {heldInEscrow > 0 ? ` · ${formatFcfaFull(heldInEscrow)} FCFA en attente de validation` : ''}
          </Text>
        )}
      </View>

      {bookings.length > 0 && (
        <View style={styles.filters} accessibilityRole="tablist">
          {FILTERS.map((f) => {
            const on = filter === f.id;
            const count = bookings.filter((b) => inFilter(b, f.id)).length;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="tab"
                accessibilityLabel={`${t(f.label)} (${count})`}
                aria-selected={on}
                style={[styles.filter, on && styles.filterOn]}
              >
                <Text style={[styles.filterLabel, on && styles.filterLabelOn]}>
                  {t(f.label)} · {count}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="solar:calendar-mark-linear" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>{t('Aucune mission')}</Text>
          <Text style={styles.emptyBody}>{t('Réservez un prestataire depuis son profil : la mission apparaîtra ici, avec le paiement.')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {/* §2.2 and §6.4, stated once at the top rather than buried: the money
              never goes directly to the prestataire. */}
          <View style={styles.rule}>
            <Icon name="solar:shield-check-bold" size={18} color={colors.foreground} />
            <Text style={styles.ruleText}>{t("Tous les paiements passent par 242Konnect. Ne remettez jamais d'argent directement au prestataire, même en pourboire.")}</Text>
          </View>

          {visible.length === 0 && (
            <Text style={styles.escrowLine}>{t('Aucune mission dans cette catégorie.')}</Text>
          )}
          {visible.map((booking) => {
            const pro = getProfessional(booking.professionalId);
            if (!pro) return null;
            const baseStatus = STATUS[booking.status];
            // An accepted mission shows where it has got to (§08).
            const status =
              booking.status === 'acceptee' && booking.stage
                ? { ...baseStatus, label: STAGE_LABELS[booking.stage] }
                : baseStatus;
            const responseDeadline = (booking.paidAt ?? 0) + RESPONSE_DELAY_HOURS * 3600_000;
            const expired = booking.status === 'payee' && Date.now() > responseDeadline;
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
                    <Text style={[styles.statusLabel, { color: status.fg }]}>{t(status.label)}</Text>
                  </View>
                </View>

                <View style={styles.meta}>
                  <View style={styles.metaRow}>
                    <Icon name="solar:calendar-mark-linear" size={16} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{booking.slot}</Text>
                  </View>
                  <Text style={styles.rate}>{formatFcfaFull(booking.rate)} FCFA</Text>
                </View>

                {(!!booking.description || !!booking.address || !!booking.duration) && (
                  <View style={styles.details}>
                    {!!booking.description && <Text style={styles.detailText}>{booking.description}</Text>}
                    {!!booking.duration && (
                      <Text style={styles.detailMuted}>
                        {t('Durée')} : {t(DURATION_LABELS[booking.duration])}
                        {booking.contractAcceptedAt ? ` · ${t('contrat signé')}` : ''}
                      </Text>
                    )}
                    {!!booking.address && (
                      <Text style={styles.detailMuted}>
                        {/* §01: private until acceptance. */}
                        {booking.status === 'acceptee' || booking.status === 'litige' || booking.status === 'validee'
                          ? `${t('Adresse communiquée au prestataire')} : ${booking.address}`
                          : `${t('Adresse privée jusqu’à acceptation')} : ${booking.address}`}
                      </Text>
                    )}
                  </View>
                )}

                {booking.status === 'payee' && (
                  <Text style={styles.escrowLine}>
                    242Konnect conserve {formatFcfaFull(booking.rate)} FCFA jusqu'à votre validation.
                    {payment ? ` Réf. ${payment.reference}.` : ''}{' '}
                    {expired
                      ? t('Le délai de réponse est dépassé.')
                      : `${t('Réponse attendue avant')} ${new Date(responseDeadline).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}.`}
                  </Text>
                )}

                {(booking.status === 'refusee' || expired) && (
                  <View style={styles.actionsCol}>
                    <Text style={styles.escrowLine}>{t("Le prestataire n'a pas accepté. Vos fonds restent protégés : choisissez un autre prestataire qualifié ou demandez le remboursement intégral.")}</Text>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => cancelBooking(booking.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Demander le remboursement de la mission avec ${pro.name}`}
                        style={styles.ghost}
                      >
                        <Text style={styles.ghostLabel}>{t('Remboursement')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          cancelBooking(booking.id);
                          navigation.navigate('Accueil');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('Choisir un autre prestataire')}
                        style={styles.solid}
                      >
                        <Text style={styles.solidLabel}>{t('Autre prestataire')}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {booking.status === 'acceptee' && (
                  <View style={styles.tracker}>
                    {STAGES.map((stage) => {
                      const reached = STAGES.indexOf(stage) <= STAGES.indexOf(booking.stage ?? 'accepted');
                      const at = booking.stageAt?.[stage];
                      return (
                        <View key={stage} style={styles.trackerRow}>
                          <View style={[styles.trackerDot, reached && styles.trackerDotOn]} />
                          <Text style={[styles.trackerLabel, reached && styles.trackerLabelOn]}>
                            {t(STAGE_LABELS[stage])}
                          </Text>
                          {!!at && (
                            <Text style={styles.trackerTime}>
                              {new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                    {booking.stage === 'completed' && (
                      <Text style={styles.escrowLine}>
                        {t('Validez ou signalez un problème sous')} {VALIDATION_DELAY_HOURS} h. {t("Les fonds restent bloqués jusqu'à votre décision.")}
                      </Text>
                    )}
                  </View>
                )}

                {booking.status === 'annulee' && (
                  <Text style={styles.escrowLine}>
                    {booking.refundUnderReview
                      ? t("Annulée après acceptation : le remboursement est calculé selon le préavis et le travail effectué, après examen par 242Konnect. Les fonds restent bloqués d'ici là.")
                      : payment
                        ? t('Remboursée intégralement.')
                        : t('Annulée avant paiement : rien n’a été débité.')}
                  </Text>
                )}

                {booking.status === 'validee' && booking.settlement && (
                  <View style={styles.breakdown}>
                    <Text style={styles.breakdownTitle}>{t('Répartition')}</Text>
                    <Row label={t('Montant de la prestation')} value={booking.settlement.total} />
                    <Row label={`Commission 242Konnect (${pct(COMMISSION_RATE)})`} value={-booking.settlement.commission} />
                    <Row
                      label={`Frais de versement (${pct(booking.settlement.speed === 'express' ? PAYOUT_EXPRESS_RATE : PAYOUT_STANDARD_RATE)})`}
                      value={-booking.settlement.payoutFee}
                    />
                    <Row label={t('Versé au prestataire')} value={booking.settlement.net} strong />
                    <Text style={styles.breakdownNote}>
                      {booking.settlement.speed === 'express'
                        ? 'Versement express, immédiat.'
                        : `Versement sous ${booking.settlement.delayDays} jours.`}
                    </Text>
                  </View>
                )}

                {booking.status === 'validee' && payment && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => shareReceipt(booking, payment, pro)}
                      accessibilityRole="button"
                      accessibilityLabel={`Télécharger le reçu de la mission avec ${pro.name}`}
                      style={styles.ghost}
                    >
                      <Text style={styles.ghostLabel}>{t('Télécharger le reçu')}</Text>
                    </Pressable>
                    {!booking.review && (
                      <Pressable
                        onPress={() => openReview(booking)}
                        accessibilityRole="button"
                        accessibilityLabel={`Laisser un avis sur ${pro.name}`}
                        style={styles.solid}
                      >
                        <Text style={styles.solidLabel}>{t('Laisser un avis')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {booking.review && (
                  <View style={styles.reviewDone}>
                    <Text style={styles.reviewStars}>
                      {'★'.repeat(booking.review.rating)}
                      <Text style={styles.reviewStarsOff}>{'★'.repeat(5 - booking.review.rating)}</Text>
                    </Text>
                    {!!booking.review.comment && (
                      <Text style={styles.reviewComment}>{booking.review.comment}</Text>
                    )}
                    {!!booking.review.photo && (
                      <Image source={{ uri: booking.review.photo }} style={styles.reviewPhoto} />
                    )}
                  </View>
                )}

                {booking.status === 'litige' && (
                  <View style={styles.details}>
                    {!!booking.dispute && (
                      <Text style={styles.detailText}>
                        {t(booking.dispute.reason)} · {t(DISPUTE_OUTCOMES.find((o) => o.id === booking.dispute!.outcome)?.label ?? '')}
                      </Text>
                    )}
                    <Text style={styles.disputeLine}>{t("Fonds gelés pendant l'examen. 242Konnect examine le contrat, le chat, les horaires et les preuves ; le prestataire peut répondre. Aucun remboursement n'est promis avant cette décision.")}</Text>
                  </View>
                )}

                {/* §04–§06: nothing is sent until the order is reviewed and paid. */}
                {booking.status === 'demandee' && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => cancelBooking(booking.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Annuler la demande à ${pro.name}`}
                      style={styles.ghost}
                    >
                      <Text style={styles.ghostLabel}>{t('Annuler')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openPayment(booking)}
                      accessibilityRole="button"
                      accessibilityLabel={`Payer la mission avec ${pro.name}`}
                      style={styles.solid}
                    >
                      <Text style={styles.solidLabel}>{t('Revoir et payer')}</Text>
                    </Pressable>
                  </View>
                )}

                {booking.status === 'payee' && !expired && (
                  <View style={styles.actionsCol}>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => cancelBooking(booking.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Annuler la demande à ${pro.name}`}
                        style={styles.ghost}
                      >
                        <Text style={styles.ghostLabel}>{t('Annuler · remboursé')}</Text>
                      </Pressable>
                      {/* Stands in for the prestataire, who has no app yet. The
                          state machine is real; only the actor is simulated, and
                          the label says so rather than pretending otherwise. */}
                      <Pressable
                        onPress={() => acceptBooking(booking.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Simuler l'acceptation par ${pro.name}`}
                        style={styles.solid}
                      >
                        <Text style={styles.solidLabel}>{t("Simuler l'acceptation")}</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => refuseBooking(booking.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Simuler un refus par ${pro.name}`}
                      style={styles.linkButton}
                    >
                      <Text style={styles.linkLabel}>{t('Simuler un refus')}</Text>
                    </Pressable>
                  </View>
                )}

                {booking.status === 'acceptee' && booking.stage !== 'completed' && (
                  <View style={styles.actionsCol}>
                    <View style={styles.actions}>
                      <Pressable
                        onPress={() => openChat(pro.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ouvrir le chat de la mission avec ${pro.name}`}
                        style={styles.ghost}
                      >
                        <Text style={styles.ghostLabel}>{t('Message')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => advanceStage(booking.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Simuler l'étape suivante pour ${pro.name}`}
                        style={styles.solid}
                      >
                        <Text style={styles.solidLabel}>{t("Simuler l'étape suivante")}</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={() => cancelBooking(booking.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Annuler la mission avec ${pro.name}`}
                      style={styles.linkButton}
                    >
                      <Text style={styles.linkLabel}>{t('Annuler (remboursement après examen)')}</Text>
                    </Pressable>
                  </View>
                )}

                {booking.status === 'acceptee' && booking.stage === 'completed' && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => openDispute(booking)}
                      accessibilityRole="button"
                      accessibilityLabel={`Signaler un problème sur la mission avec ${pro.name}`}
                      style={styles.ghost}
                    >
                      <Text style={styles.ghostLabel}>{t('Signaler un problème')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openValidation(booking)}
                      accessibilityRole="button"
                      accessibilityLabel={`Valider la prestation de ${pro.name}`}
                      style={styles.solid}
                    >
                      <Text style={styles.solidLabel}>{t('Valider')}</Text>
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
                : `Une demande de paiement de ${formatFcfaFull(paying?.rate ?? 0)} FCFA a été envoyée au ${formatNational(payPhone, payCountry)}. Saisissez votre code PIN Mobile Money pour confirmer.`}
            </Text>
            {momoPhase === 'waiting' && (
              <Text style={styles.countdown}>{secondsLeft} s restantes</Text>
            )}
            <Pressable
              onPress={stopMomo}
              accessibilityRole="button"
              accessibilityLabel={t('Annuler le paiement')}
              style={styles.ghostWide}
            >
              <Text style={styles.ghostLabel}>{t('Annuler')}</Text>
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
            <Text style={styles.doneEscrow}>{t("242Konnect conserve ce montant. Le prestataire ne sera payé qu'après votre validation de la prestation.")}</Text>
            <Text style={styles.doneBody}>
              {t('Demande envoyée. Réponse du prestataire attendue sous')} {RESPONSE_DELAY_HOURS} h.
            </Text>
            {receipt.simulated && (
              <Text style={styles.demoNote}>{t("Démonstration : aucun argent n'a été débité. Les paiements réels nécessitent les comptes marchands MTN MoMo et Airtel Money côté serveur.")}</Text>
            )}
            {/* The note asks for the receipt to be downloadable, not merely
                shown, so it is offered at the moment it is generated. */}
            <Pressable
              onPress={() => {
                const booking = paying;
                const payment = payments.find((p) => p.reference === receipt.reference);
                const pro = booking ? getProfessional(booking.professionalId) : null;
                if (booking && payment && pro) shareReceipt(booking, payment, pro);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Télécharger le reçu')}
              style={styles.ghostWide}
            >
              <Text style={styles.ghostLabel}>{t('Télécharger le reçu')}</Text>
            </Pressable>
            <Pressable onPress={closePayment} accessibilityRole="button" style={styles.solidWide}>
              <Text style={styles.solidLabel}>{t('Terminé')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* §04: the whole order, and a total identical to what is
                authorised — no fee appears only after confirmation. */}
            {paying && (() => {
              const pro = getProfessional(paying.professionalId);
              return (
                <View style={styles.breakdown}>
                  <Text style={styles.breakdownTitle}>{t('Récapitulatif de la commande')}</Text>
                  <TextRow label={t('Service')} value={pro ? professionalTrade(pro)?.label ?? '' : ''} />
                  <TextRow label={t('Prestataire')} value={pro?.name ?? ''} />
                  <TextRow label={t('Horaire')} value={paying.slot} />
                  {!!paying.duration && <TextRow label={t('Durée')} value={t(DURATION_LABELS[paying.duration])} />}
                  {!!paying.address && <TextRow label={t('Adresse')} value={paying.address} />}
                  <Row label={t('Prix de la prestation')} value={paying.rate} />
                  <Row label={t('Frais de protection 242Konnect')} value={PROTECTION_FEE} />
                  <Row label={t('Total autorisé')} value={paying.rate + PROTECTION_FEE} strong />
                </View>
              );
            })()}
            <Text style={styles.sheetEscrow}>{t("Vous payez 242Konnect maintenant et la demande est envoyée ensuite. Le paiement reste bloqué : il n'est versé au prestataire qu'après votre validation.")}</Text>

            <Text style={styles.sheetHint}>{t('Moyen de paiement')}</Text>
            {methods.map((m) => {
              const selected = method === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMethod(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  aria-selected={selected}
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
                <PhoneField
                  value={payPhone}
                  onChangeText={setPayPhone}
                  country={payCountry}
                  onCountryChange={setPayCountry}
                  label={t('Numéro Mobile Money')}
                />
                <Text style={styles.payPhoneHint}>{t('Le numéro du compte Mobile Money à débiter. Vous recevrez une demande de code PIN sur ce téléphone.')}</Text>
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

            {/* §06: the rules, then an explicit authorisation. */}
            <View style={styles.policy}>
              <Text style={styles.breakdownTitle}>{t('Annulation et remboursement')}</Text>
              <Text style={styles.policyText}>{t('Avant acceptation : remboursement intégral. Après acceptation : selon le préavis et le travail effectué, après examen. Refus ou absence de réponse sous 24 h : autre prestataire ou remboursement intégral.')}</Text>
            </View>
            <Pressable
              onPress={() => setAuthorized((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityLabel={t("J'autorise le paiement")}
              aria-checked={authorized}
              style={styles.authRow}
            >
              <View style={[styles.box, authorized && styles.boxOn]}>
                {authorized && <Icon name="242k:check" size={14} color={colors.accentForeground} />}
              </View>
              <Text style={styles.authLabel}>
                {t("J'autorise 242Konnect à prélever")} {formatFcfaFull(paying?.rate ?? 0)} FCFA {t("et à les conserver jusqu'à ma validation.")}
              </Text>
            </Pressable>

            {payError && (
              <View style={styles.payError}>
                <Text style={styles.payErrorText}>{payError}</Text>
              </View>
            )}

            <Pressable
              onPress={confirmPayment}
              disabled={!canPay}
              accessibilityRole="button"
              accessibilityLabel={t('Confirmer le paiement')}
              aria-disabled={!canPay}
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

      {/* ---- Review, after the service ---- */}
      <Sheet visible={!!reviewing} title={t('Votre avis')} onClose={() => setReviewing(null)}>
        <Text style={styles.sheetEscrow}>{t('Votre avis aide les autres clients à choisir, et le prestataire à progresser.')}</Text>

        <Text style={styles.sheetHint}>{t('Votre note')}</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              onPress={() => setRating(value)}
              accessibilityRole="button"
              accessibilityLabel={`Donner ${value} étoile${value > 1 ? 's' : ''}`}
              aria-selected={rating === value}
              hitSlop={4}
            >
              <Text style={[styles.star, value <= rating && styles.starOn]}>★</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sheetHint}>{t('Votre commentaire')}</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          multiline
          placeholder={t("Comment s'est passée la prestation ?")}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={t('Votre commentaire')}
          style={styles.reviewInput}
        />

        <Text style={styles.sheetHint}>Photo (facultatif)</Text>
        <View style={styles.photoRow}>
          {!!reviewPhoto && <Image source={{ uri: reviewPhoto }} style={styles.reviewPhoto} />}
          <Pressable
            onPress={addReviewPhoto}
            accessibilityRole="button"
            accessibilityLabel={t("Ajouter une photo à l'avis")}
            style={styles.ghost}
          >
            <Text style={styles.ghostLabel}>{reviewPhoto ? 'Changer la photo' : 'Ajouter une photo'}</Text>
          </Pressable>
        </View>

        {!!reviewError && (
          <View style={styles.payError}>
            <Text style={styles.payErrorText}>{reviewError}</Text>
          </View>
        )}

        <Pressable
          onPress={submitReview}
          accessibilityRole="button"
          accessibilityLabel={t('Publier mon avis')}
          style={styles.solidWide}
        >
          <Text style={styles.solidLabel}>{t('Publier mon avis')}</Text>
        </Pressable>
      </Sheet>

      {/* ---- Dispute (§10) ---- */}
      <Sheet visible={!!disputing} title={t('Signaler un problème')} onClose={() => setDisputing(null)}>
        <Text style={styles.sheetEscrow}>{t("Le paiement reste bloqué pendant l'examen. 242Konnect examine le contrat, le chat, les horaires et les preuves, et le prestataire peut répondre.")}</Text>
        <Text style={styles.sheetHint}>{t('Motif')}</Text>
        <View style={styles.chips}>
          {DISPUTE_REASONS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setDisputeReason(r)}
              accessibilityRole="radio"
              accessibilityLabel={t(r)}
              aria-selected={disputeReason === r}
              style={[styles.chip, disputeReason === r && styles.chipOn]}
            >
              <Text style={styles.chipLabel}>{t(r)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sheetHint}>{t('Ce que vous demandez')}</Text>
        <View style={styles.chips}>
          {DISPUTE_OUTCOMES.map((o) => (
            <Pressable
              key={o.id}
              onPress={() => setDisputeOutcome(o.id)}
              accessibilityRole="radio"
              accessibilityLabel={t(o.label)}
              aria-selected={disputeOutcome === o.id}
              style={[styles.chip, disputeOutcome === o.id && styles.chipOn]}
            >
              <Text style={styles.chipLabel}>{t(o.label)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.sheetHint}>{t('Détails')}</Text>
        <TextInput
          value={disputeDetails}
          onChangeText={setDisputeDetails}
          multiline
          placeholder={t("Décrivez ce qui s'est passé")}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={t('Détails du problème')}
          style={styles.reviewInput}
        />
        <View style={styles.photoRow}>
          {!!disputePhoto && <Image source={{ uri: disputePhoto }} style={styles.reviewPhoto} />}
          <Pressable
            onPress={async () => {
              try {
                const next = await pickAvatar();
                if (next) setDisputePhoto(next);
              } catch {
                // An unusable image is not worth blocking the report over.
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Ajouter une preuve photo')}
            style={styles.ghost}
          >
            <Text style={styles.ghostLabel}>{t('Ajouter une preuve')}</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={submitDispute}
          disabled={!disputeReason || !disputeOutcome}
          accessibilityRole="button"
          accessibilityLabel={t('Envoyer le signalement')}
          style={[styles.solidWide, (!disputeReason || !disputeOutcome) && styles.solidOff]}
        >
          <Text style={styles.solidLabel}>{t('Envoyer le signalement')}</Text>
        </Pressable>
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
            <Text style={styles.demoNote}>{t("Démonstration : aucun versement réel n'a lieu.")}</Text>
            <Pressable onPress={() => setValidating(null)} accessibilityRole="button" style={styles.solidWide}>
              <Text style={styles.solidLabel}>{t('Terminé')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sheetEscrow}>{t('En validant, vous confirmez que la prestation a été réalisée. Les fonds sont alors débloqués et versés au prestataire.')}</Text>

            <Text style={styles.sheetHint}>{t('Mode de versement au prestataire')}</Text>
            {(['standard', 'express'] as PayoutSpeed[]).map((option) => {
              const selected = speed === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSpeed(option)}
                  accessibilityRole="button"
                  accessibilityLabel={option === 'standard' ? 'Versement standard' : 'Versement express'}
                  aria-selected={selected}
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
                <Row label={t('Montant de la prestation')} value={preview.total} />
                <Row label={`Commission 242Konnect (${pct(COMMISSION_RATE)})`} value={-preview.commission} />
                <Row
                  label={`Frais de versement (${pct(speed === 'express' ? PAYOUT_EXPRESS_RATE : PAYOUT_STANDARD_RATE)})`}
                  value={-preview.payoutFee}
                />
                <Row label={t('Versé au prestataire')} value={preview.net} strong />
              </View>
            )}

            <Pressable
              onPress={confirmValidation}
              accessibilityRole="button"
              accessibilityLabel={t('Confirmer la validation')}
              style={styles.solidWide}
            >
              <Text style={styles.solidLabel}>{t('Valider et débloquer les fonds')}</Text>
            </Pressable>
          </>
        )}
      </Sheet>
    </View>
  );
}

function TextRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, styles.rowText]} numberOfLines={2}>{value}</Text>
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
  actionsCol: { gap: 8 },
  linkButton: { alignSelf: 'center', paddingVertical: 4 },
  linkLabel: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.mutedForeground, textDecorationLine: 'underline' },
  details: { gap: 4 },
  detailText: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 19, color: colors.foreground },
  detailMuted: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  tracker: { gap: 6 },
  trackerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  trackerDotOn: { backgroundColor: colors.success },
  trackerLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  trackerLabelOn: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  trackerTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 4 },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterLabel: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.foreground },
  filterLabelOn: { color: colors.primaryForeground },
  rowText: { flexShrink: 1, textAlign: 'right' },
  policy: {
    padding: 12,
    gap: 4,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  policyText: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.foreground },
  authRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
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
  reviewDone: {
    marginTop: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    gap: 6,
  },
  reviewStars: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.accent },
  reviewStarsOff: { color: colors.border },
  reviewComment: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.foreground },
  reviewPhoto: { width: 84, height: 84, borderRadius: radius.lg, marginTop: 2 },
  starRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 4 },
  star: { fontSize: 32, color: colors.border },
  starOn: { color: colors.accent },
  reviewInput: {
    minHeight: 92,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
    textAlignVertical: 'top',
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
