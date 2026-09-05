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
 * Mission lifecycle, following §5.5–5.8.
 *
 * `payee` is the escrow state: the client has paid 242Konnect and the money is
 * held. It is not the end of the flow — `validee` is, and only then is the
 * prestataire settled.
 *
 * The states a prestataire drives (accepting, starting, finishing) are absent
 * because the Espace Prestataire does not exist yet; a client can validate a
 * paid mission directly rather than the app inventing a counterparty's actions.
 */
export type MissionStatus =
  /** Sent, waiting for the prestataire to accept. Nothing is payable yet. */
  | 'demandee'
  /** Accepted; the client can now pay. */
  | 'acceptee'
  | 'payee'
  | 'validee'
  | 'litige'
  | 'annulee';

export type Booking = {
  id: string;
  professionalId: string;
  slot: string;
  /** Agreed price for the prestation, in FCFA. */
  rate: number;
  status: MissionStatus;
  createdAt: number;
  paymentId?: string;
  /** Recorded when the client validates, so the receipt can show the split. */
  settlement?: Settlement;
  /** When the prestataire accepted, which is what makes the mission payable. */
  acceptedAt?: number;
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

/**
 * Business data (§2.2). Establishments and collaborators are genuinely
 * manageable on the device — they are the company's own records, not something
 * that needs another user to exist — so the Espace Business can actually do
 * something rather than showing empty dashboards everywhere.
 */
export type Establishment = {
  id: string;
  name: string;
  kind: 'agence' | 'bureau' | 'magasin' | 'chantier' | 'site';
  address: string;
};

/** Access levels, from §2.2. */
export type CollaboratorRole =
  | 'administrateur'
  | 'responsable'
  | 'comptable'
  | 'acheteur'
  | 'maintenance'
  | 'employe';

export const COLLABORATOR_ROLES: { id: CollaboratorRole; label: string; can: string }[] = [
  { id: 'administrateur', label: 'Administrateur', can: 'Tous les droits' },
  { id: 'responsable', label: 'Responsable', can: 'Créer et valider les demandes' },
  { id: 'comptable', label: 'Comptable', can: 'Factures, paiements et budgets' },
  { id: 'acheteur', label: 'Acheteur', can: 'Comparer et attribuer les missions' },
  { id: 'maintenance', label: 'Responsable maintenance', can: 'Demandes techniques' },
  { id: 'employe', label: 'Employé autorisé', can: 'Créer une demande' },
];

export const ESTABLISHMENT_KINDS: { id: Establishment['kind']; label: string }[] = [
  { id: 'agence', label: 'Agence' },
  { id: 'bureau', label: 'Bureau' },
  { id: 'magasin', label: 'Magasin' },
  { id: 'chantier', label: 'Chantier' },
  { id: 'site', label: "Site d'intervention" },
];

export type Collaborator = {
  id: string;
  name: string;
  email: string;
  role: CollaboratorRole;
  invitedAt: number;
  /** No backend to send the invitation, so it never becomes 'active'. */
  status: 'invite';
};

type UserData = {
  favorites: Record<string, boolean>;
  city: City;
  bookings: Booking[];
  payments: Payment[];
  threads: Record<string, Thread>;
  establishments: Establishment[];
  collaborators: Collaborator[];
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
  establishments: [],
  collaborators: [],
};

const keyFor = (phone: string) => `242k.data.${phone}`;

type Store = UserData & {
  ready: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  favoriteCount: number;
  setCity: (city: City) => void;
  addBooking: (input: { professionalId: string; slot: string; rate: number }) => Booking;
  /** Marks a request accepted, which is what makes it payable. */
  acceptBooking: (bookingId: string) => void;
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
  /** Opens a dispute; the money stays blocked until 242Konnect decides (§6.4). */
  disputeMission: (bookingId: string) => void;
  sendMessage: (professionalId: string, text: string) => void;
  ensureThread: (professionalId: string) => void;
  addEstablishment: (input: Omit<Establishment, 'id'>) => void;
  removeEstablishment: (id: string) => void;
  inviteCollaborator: (input: { name: string; email: string; role: CollaboratorRole }) => void;
  removeCollaborator: (id: string) => void;
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
    const addBooking: Store['addBooking'] = ({ professionalId, slot, rate }) => {
      const booking: Booking = {
        id: uid(),
        professionalId,
        slot,
        rate,
        // A request, not yet payable. The note's sequence is Demande →
        // Acceptation → Paiement, and paying before anyone accepted skips the
        // step where the prestataire agrees to the job.
        status: 'demandee',
        createdAt: Date.now(),
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
      if (!booking || booking.status !== 'demandee') return;
      const pro = getProfessional(booking.professionalId);
      update((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId ? { ...b, status: 'acceptee', acceptedAt: Date.now() } : b
        ),
        notices: [
          {
            id: uid(),
            title: 'Demande acceptée',
            body: `${pro?.name ?? 'Le prestataire'} a accepté votre demande. Vous pouvez procéder au paiement.`,
            at: Date.now(),
            read: false,
          },
          ...prev.notices,
        ],
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
          b.id === bookingId ? { ...b, status: 'payee', paymentId: payment.id } : b
        ),
        notices: [
          {
            id: uid(),
            title: 'Paiement reçu',
            body: `Votre paiement de ${amount.toLocaleString('fr-FR')} FCFA est conservé par 242Konnect jusqu'à votre validation. Reçu ${payment.reference}.`,
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
      if (!booking || booking.status !== 'payee') return undefined;
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
      reviewMission,
      notices: data.notices,
      markNoticesRead,
      cancelBooking: (id) =>
        update((prev) => {
          const booking = prev.bookings.find((b) => b.id === id);
          return {
            ...prev,
            bookings: prev.bookings.map((b) => (b.id === id ? { ...b, status: 'annulee' } : b)),
            // §6.9: cancelling before the service means the money comes back.
            payments: prev.payments.map((p) =>
              p.id === booking?.paymentId ? { ...p, refundedAt: Date.now() } : p
            ),
          };
        }),
      payBooking,
      validateMission,
      disputeMission: (id) =>
        update((prev) => ({
          ...prev,
          bookings: prev.bookings.map((b) => (b.id === id ? { ...b, status: 'litige' } : b)),
        })),
      sendMessage,
      ensureThread: (professionalId) =>
        update((prev) =>
          prev.threads[professionalId]
            ? prev
            : { ...prev, threads: { ...prev.threads, [professionalId]: { professionalId, messages: [] } } }
        ),
      addEstablishment: (input) =>
        update((prev) => ({
          ...prev,
          establishments: [...prev.establishments, { ...input, id: uid() }],
        })),
      removeEstablishment: (id) =>
        update((prev) => ({
          ...prev,
          establishments: prev.establishments.filter((e) => e.id !== id),
        })),
      inviteCollaborator: (input) =>
        update((prev) => ({
          ...prev,
          collaborators: [
            ...prev.collaborators,
            { ...input, id: uid(), invitedAt: Date.now(), status: 'invite' },
          ],
        })),
      removeCollaborator: (id) =>
        update((prev) => ({
          ...prev,
          collaborators: prev.collaborators.filter((c) => c.id !== id),
        })),
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
