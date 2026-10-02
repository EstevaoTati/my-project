import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONGO_CITIES } from './countries';
import { getProfessional } from './data';
import { useAuth } from './auth';
import { settle, type PaymentMethod, type PayoutSpeed, type Settlement } from './payments';

/**
 * Everything that belongs to one signed-in person.
 *
 * Keyed by phone number, so two accounts on the same device keep separate
 * favourites, missions, payments and threads. It loads on sign-in and clears on
 * sign-out — otherwise the next person to sign in would briefly see the
 * previous person's data.
 *
 * Still device-local. Swapping in a backend means replacing `load` and `save`.
 */

/**
 * The cities the marketplace can be browsed in.
 *
 * Drawn from `countries.ts` rather than hard-coded, so the two places that name
 * Congolese cities — this picker and the sign-up location field — cannot drift
 * apart. The United States is a served country for *accounts*, but there are no
 * prestataires there yet, so it is deliberately absent from the browse picker.
 */
export const CITIES = CONGO_CITIES.map((c) => `${c}, Rép. du Congo`);
export type City = string;

/**
 * Mission lifecycle — "App V1 Processus de commande, paiement et service".
 *
 * The order is the specification's, and it is deliberately not the older
 * Demande → Acceptation → Paiement: "242Konnect doit autoriser puis conserver
 * les fonds jusqu'à la confirmation du service". The client reviews and
 * authorises first; only then is the request sent (§07), so a prestataire never
 * accepts work nobody has paid for.
 *
 *   demandee  drafted, reviewed, not yet paid — nothing has been sent
 *   payee     paid and held; request sent, waiting for the prestataire (§07)
 *   refusee   declined or expired; choose another prestataire or be refunded
 *   acceptee  accepted; `stage` tracks On the way → Arrived → In progress →
 *             Completed (§08)
 *   validee   the client approved and released the funds (§09)
 *   litige    the client reported an issue; funds frozen for review (§10)
 *   annulee   cancelled; refund per §11
 *
 * Money stays held through payee, acceptee and litige — "les fonds restent
 * bloqués pendant l'attente, l'exécution et tout litige ouvert".
 */
export type MissionStatus =
  | 'demandee'
  | 'payee'
  | 'refusee'
  | 'acceptee'
  | 'validee'
  | 'litige'
  | 'annulee';

/** §08, in order. */
export type MissionStage = 'accepted' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed';
export const STAGES: MissionStage[] = ['accepted', 'on_the_way', 'arrived', 'in_progress', 'completed'];

/** §02: from a few hours to recurring services. */
export type MissionDuration = 'hours' | 'days' | 'weeks' | 'months' | 'recurring';
/** "Un projet de plus de sept jours déclenche jalons et contrat." */
export const LONG_DURATIONS: MissionDuration[] = ['weeks', 'months', 'recurring'];

/** §07: how long a prestataire has to answer before the request expires. */
export const RESPONSE_DELAY_HOURS = 24;
/** §09: "un délai de validation clairement annoncé". */
export const VALIDATION_DELAY_HOURS = 48;

/** §10: a structured dispute, never an automatic refund. */
export type Dispute = {
  reason: string;
  outcome: 'redo' | 'partial_refund' | 'full_refund';
  details: string;
  photo?: string;
  at: number;
};

export type Booking = {
  id: string;
  professionalId: string;
  slot: string;
  /** Agreed price for the prestation, in FCFA. */
  rate: number;
  status: MissionStatus;
  createdAt: number;
  /** §01: what is to be done. */
  description?: string;
  /**
   * §01: the account's address or another one for this mission. Private until
   * acceptance — the prestataire is shown only the zone before then.
   */
  address?: string;
  /** §02. */
  duration?: MissionDuration;
  /** §03: signed project contract, for long projects. */
  contractAcceptedAt?: number;
  /**
   * §06: one key per order, generated when the order is drafted and sent with
   * every payment attempt, so a replay can never become a second debit.
   */
  idempotencyKey?: string;
  paymentId?: string;
  /** When the funds were authorised and the request sent (§07). */
  paidAt?: number;
  /** Recorded when the client validates, so the receipt can show the split. */
  settlement?: Settlement;
  /** When the prestataire accepted (§08). */
  acceptedAt?: number;
  /** §08 progress, with the time each step was reached. */
  stage?: MissionStage;
  stageAt?: Partial<Record<MissionStage, number>>;
  /** §10. */
  dispute?: Dispute;
  /** §11: cancelled after acceptance — the refund depends on review. */
  refundUnderReview?: boolean;
  /** The client's review, left after the service (§11 of the correction note). */
  review?: Review;
};

/**
 * What the client says about a finished prestation.
 *
 * The correction note asks for all three: "laisser un commentaire sur le
 * service", "donner une note", "ajouter une photo si nécessaire". The photo
 * goes through the same bounded pipeline as avatars — an unbounded one here
 * would refill the storage the avatar fix just emptied.
 */
export type Review = {
  /** 1 to 5. */
  rating: number;
  comment: string;
  /** Optional, as a data URI. */
  photo?: string;
  at: number;
};

export type Payment = {
  id: string;
  bookingId: string;
  method: PaymentMethod;
  /** What the client paid into 242Konnect. */
  amount: number;
  /** Human-readable reference shown on the receipt (§6.7). */
  reference: string;
  /** The operator's own transaction id, for Mobile Money payments. */
  operatorReference?: string;
  /** The MSISDN debited, for Mobile Money payments. */
  payerPhone?: string;
  createdAt: number;
  /** Set once the funds are released to the prestataire. */
  releasedAt?: number;
  /** Set if the mission was cancelled and the money returned (§6.9). */
  refundedAt?: number;
};

/** A notification the client sees in the bell menu. */
export type Notice = {
  id: string;
  title: string;
  body: string;
  at: number;
  read: boolean;
};

export type Message = {
  id: string;
  /** 'me' for the signed-in user, otherwise the prestataire's id. */
  from: string;
  text: string;
  at: number;
};

export type Thread = { professionalId: string; messages: Message[] };

type UserData = {
  favorites: Record<string, boolean>;
  city: City;
  bookings: Booking[];
  payments: Payment[];
  threads: Record<string, Thread>;
  notices: Notice[];
};

const EMPTY: UserData = {
  favorites: {},
  // Pointe-Noire explicitly, not CITIES[0]: the list is alphabetical-ish by
  // département and starts at Brazzaville, but the marketplace's prestataires
  // are in Pointe-Noire.
  city: 'Pointe-Noire, Rép. du Congo',
  bookings: [],
  notices: [],
  payments: [],
  threads: {},
};

const keyFor = (phone: string) => `242k.data.${phone}`;

type Store = UserData & {
  ready: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  favoriteCount: number;
  setCity: (city: City) => void;
  addBooking: (input: {
    professionalId: string;
    slot: string;
    rate: number;
    description?: string;
    address?: string;
    duration?: MissionDuration;
    contractAcceptedAt?: number;
  }) => Booking;
  /** The prestataire accepts a paid request (§08). Only one can. */
  acceptBooking: (bookingId: string) => void;
  /** The prestataire declines, or the request expires (§07). */
  refuseBooking: (bookingId: string) => void;
  /** Moves an accepted mission to its next §08 step. */
  advanceStage: (bookingId: string) => void;
  /** Records the client's rating, comment and optional photo. */
  reviewMission: (bookingId: string, review: Omit<Review, 'at'>) => void;
  /** Notifications for acceptance and payment (§11 of the correction note). */
  notices: Notice[];
  markNoticesRead: () => void;
  cancelBooking: (id: string) => void;
  /** Client pays 242Konnect; the money is held, not forwarded (§6.4). */
  /**
   * Records a payment into escrow. Called *after* the money has actually been
   * collected — for Mobile Money that means after the operator reported the
   * collection successful, not when the payer tapped "payer".
   */
  payBooking: (
    bookingId: string,
    method: PaymentMethod,
    amount: number,
    details?: { operatorReference?: string; payerPhone?: string }
  ) => Payment;
  /** Client validates the work; this is what releases the funds (§5.8). */
  validateMission: (bookingId: string, speed: PayoutSpeed) => Settlement | undefined;
  /** Opens a dispute; the money stays blocked until 242Konnect decides (§10). */
  disputeMission: (bookingId: string, dispute: Omit<Dispute, 'at'>) => void;
  sendMessage: (professionalId: string, text: string) => void;
  ensureThread: (professionalId: string) => void;
  /** Total the client has actually paid in, across all missions. */
  totalPaid: number;
  /** Money currently held by 242Konnect for this client. */
  heldInEscrow: number;
};

const AppContext = createContext<Store | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10);

/** "242K-8F3A2B" — short enough to read out over the phone. */
const reference = () => `242K-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAuth();
  const phone = account?.phone ?? null;
  const [data, setData] = useState<UserData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      if (!phone) {
        setData(EMPTY);
        setReady(true);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(keyFor(phone));
        if (!cancelled) setData(raw ? { ...EMPTY, ...(JSON.parse(raw) as UserData) } : EMPTY);
      } catch {
        if (!cancelled) setData(EMPTY);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  // One write path, so no caller can update state and forget to persist.
  const update = useCallback(
    (fn: (prev: UserData) => UserData) => {
      setData((prev) => {
        const next = fn(prev);
        if (phone) AsyncStorage.setItem(keyFor(phone), JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [phone]
  );

  const value = useMemo<Store>(() => {
    const addBooking: Store['addBooking'] = ({ professionalId, slot, rate, ...details }) => {
      const booking: Booking = {
        id: uid(),
        professionalId,
        slot,
        rate,
        ...details,
        // Drafted, not sent: the request goes out once the payment is
        // authorised (Commande §07).
        status: 'demandee',
        createdAt: Date.now(),
        idempotencyKey: `${uid()}${uid()}${Date.now().toString(36)}`,
      };
      update((prev) => ({ ...prev, bookings: [booking, ...prev.bookings] }));
      return booking;
    };

    /**
     * The prestataire accepting the request.
     *
     * There is no Espace Prestataire yet, and no second user to drive it, so
     * this is invoked from the client's own screen behind a label that says so.
     * The state machine is real; the actor is stood in for. That is the
     * opposite of inventing an acceptance the client never sees.
     */
    const acceptBooking: Store['acceptBooking'] = (bookingId) => {
      const booking = data.bookings.find((b) => b.id === bookingId);
      // Only a paid, still-open request can be accepted — and only once.
      if (!booking || booking.status !== 'payee') return;
      const pro = getProfessional(booking.professionalId);
      const now = Date.now();
      update((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, status: 'acceptee', acceptedAt: now, stage: 'accepted', stageAt: { accepted: now } }
            : b
        ),
        notices: [
          {
            id: uid(),
            title: 'Demande acceptée',
            body: `${pro?.name ?? 'Le prestataire'} a accepté votre demande. Suivez la mission dans l'onglet Missions.`,
            at: now,
            read: false,
          },
          ...prev.notices,
        ],
      }));
    };

    const refuseBooking: Store['refuseBooking'] = (bookingId) => {
      const booking = data.bookings.find((b) => b.id === bookingId);
      if (!booking || booking.status !== 'payee') return;
      update((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => (b.id === bookingId ? { ...b, status: 'refusee' } : b)),
        notices: [
          {
            id: uid(),
            title: 'Demande non acceptée',
            body: 'Choisissez un autre prestataire ou demandez le remboursement. Vos fonds restent protégés.',
            at: Date.now(),
            read: false,
          },
          ...prev.notices,
        ],
      }));
    };

    const advanceStage: Store['advanceStage'] = (bookingId) => {
      update((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => {
          if (b.id !== bookingId || b.status !== 'acceptee') return b;
          const next = STAGES[STAGES.indexOf(b.stage ?? 'accepted') + 1];
          if (!next) return b;
          // §10 of the prestataire journey: every step is timestamped.
          return { ...b, stage: next, stageAt: { ...b.stageAt, [next]: Date.now() } };
        }),
      }));
    };

    const reviewMission: Store['reviewMission'] = (bookingId, review) => {
      update((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId ? { ...b, review: { ...review, at: Date.now() } } : b
        ),
      }));
    };

    const markNoticesRead: Store['markNoticesRead'] = () => {
      update((prev) => ({ ...prev, notices: prev.notices.map((n) => ({ ...n, read: true })) }));
    };

    const payBooking: Store['payBooking'] = (bookingId, method, amount, details = {}) => {
      // §06 idempotency on the device as well: an order that already has a
      // payment returns it rather than recording a second one.
      const booking = data.bookings.find((b) => b.id === bookingId);
      const existing = booking?.paymentId && data.payments.find((p) => p.id === booking.paymentId);
      if (existing) return existing;
      const payment: Payment = {
        id: uid(),
        bookingId,
        method,
        amount,
        reference: reference(),
        operatorReference: details.operatorReference,
        payerPhone: details.payerPhone,
        createdAt: Date.now(),
      };
      update((prev) => ({
        ...prev,
        payments: [payment, ...prev.payments],
        bookings: prev.bookings.map((b) =>
          b.id === bookingId
            ? { ...b, status: 'payee', paymentId: payment.id, paidAt: payment.createdAt }
            : b
        ),
        notices: [
          {
            id: uid(),
            title: 'Paiement protégé · demande envoyée',
            body: `Votre paiement de ${amount.toLocaleString('fr-FR')} FCFA est conservé par 242Konnect jusqu'à votre validation. Reçu ${payment.reference}. Réponse du prestataire attendue sous ${RESPONSE_DELAY_HOURS} h.`,
            at: Date.now(),
            read: false,
          },
          ...prev.notices,
        ],
      }));
      return payment;
    };

    const validateMission: Store['validateMission'] = (bookingId, speed) => {
      const booking = data.bookings.find((b) => b.id === bookingId);
      // §09: only a completed mission can be approved and released.
      if (!booking || booking.status !== 'acceptee' || booking.stage !== 'completed') return undefined;
      const result = settle(booking.rate, speed);
      update((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId ? { ...b, status: 'validee', settlement: result } : b
        ),
        payments: prev.payments.map((p) =>
          p.id === booking.paymentId ? { ...p, releasedAt: Date.now() } : p
        ),
      }));
      return result;
    };

    const sendMessage: Store['sendMessage'] = (professionalId, text) => {
      const mine: Message = { id: uid(), from: 'me', text, at: Date.now() };
      update((prev) => {
        const thread = prev.threads[professionalId] ?? { professionalId, messages: [] };
        return {
          ...prev,
          threads: {
            ...prev.threads,
            [professionalId]: { ...thread, messages: [...thread.messages, mine] },
          },
        };
      });
    };

    return {
      ...data,
      ready,
      isFavorite: (id) => !!data.favorites[id],
      toggleFavorite: (id) =>
        update((prev) => ({ ...prev, favorites: { ...prev.favorites, [id]: !prev.favorites[id] } })),
      favoriteCount: Object.values(data.favorites).filter(Boolean).length,
      setCity: (city) => update((prev) => ({ ...prev, city })),
      addBooking,
      acceptBooking,
      refuseBooking,
      advanceStage,
      reviewMission,
      notices: data.notices,
      markNoticesRead,
      cancelBooking: (id) =>
        update((prev) => {
          const booking = prev.bookings.find((b) => b.id === id);
          if (!booking) return prev;
          // §11: before acceptance — including a refused or expired request —
          // the refund is full and immediate. After acceptance it depends on
          // the notice given and the work done, so the funds stay held and the
          // cancellation goes to review. Nothing is promised automatically.
          const afterAcceptance = booking.status === 'acceptee';
          return {
            ...prev,
            bookings: prev.bookings.map((b) =>
              b.id === id ? { ...b, status: 'annulee', refundUnderReview: afterAcceptance || undefined } : b
            ),
            payments: afterAcceptance
              ? prev.payments
              : prev.payments.map((p) =>
                  p.id === booking.paymentId ? { ...p, refundedAt: Date.now() } : p
                ),
          };
        }),
      payBooking,
      validateMission,
      disputeMission: (id, dispute) =>
        update((prev) => ({
          ...prev,
          bookings: prev.bookings.map((b) =>
            b.id === id && b.status === 'acceptee'
              ? { ...b, status: 'litige', dispute: { ...dispute, at: Date.now() } }
              : b
          ),
        })),
      sendMessage,
      ensureThread: (professionalId) =>
        update((prev) =>
          prev.threads[professionalId]
            ? prev
            : { ...prev, threads: { ...prev.threads, [professionalId]: { professionalId, messages: [] } } }
        ),
      totalPaid: data.payments.filter((p) => !p.refundedAt).reduce((sum, p) => sum + p.amount, 0),
      heldInEscrow: data.payments
        .filter((p) => !p.releasedAt && !p.refundedAt)
        .reduce((sum, p) => sum + p.amount, 0),
    };
  }, [data, ready, update]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useStore must be used inside <AppProvider>');
  return ctx;
}
