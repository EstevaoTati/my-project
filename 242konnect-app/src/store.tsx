import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './auth';

/**
 * Everything that belongs to one signed-in person.
 *
 * Keyed by phone number, so two accounts on the same device keep separate
 * favourites, bookings, threads and payments rather than sharing one pile.
 * It loads when someone signs in and clears when they sign out — otherwise the
 * next person to sign in would briefly see the previous person's data.
 *
 * Still device-local. Swapping in a backend means replacing `load` and `save`.
 */

export const CITIES = ['Pointe-Noire, Rép. du Congo', 'Brazzaville, Rép. du Congo'] as const;
export type City = (typeof CITIES)[number];

export type BookingStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';

export type Booking = {
  id: string;
  professionalId: string;
  slot: string;
  /** Agreed hourly rate at the time of booking, in FCFA. */
  rate: number;
  status: BookingStatus;
  createdAt: number;
  paymentId?: string;
};

export type PaymentMethod = 'mtn' | 'airtel' | 'especes';

export type Payment = {
  id: string;
  bookingId: string;
  method: PaymentMethod;
  amount: number;
  /** Human-readable reference shown on the receipt. */
  reference: string;
  createdAt: number;
};

export type Message = {
  id: string;
  /** 'me' for the signed-in user, otherwise the professional's id. */
  from: string;
  text: string;
  at: number;
};

export type Thread = {
  professionalId: string;
  messages: Message[];
};

type UserData = {
  favorites: Record<string, boolean>;
  city: City;
  bookings: Booking[];
  payments: Payment[];
  threads: Record<string, Thread>;
};

const EMPTY: UserData = {
  favorites: {},
  city: CITIES[0],
  bookings: [],
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
  addBooking: (input: { professionalId: string; slot: string; rate: number }) => Booking;
  cancelBooking: (id: string) => void;
  payBooking: (bookingId: string, method: PaymentMethod, amount: number) => Payment;
  sendMessage: (professionalId: string, text: string) => void;
  /** Opens a thread if it doesn't exist yet, so the list has something to show. */
  ensureThread: (professionalId: string) => void;
  unreadThreads: number;
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
        status: 'confirmed',
        createdAt: Date.now(),
      };
      update((prev) => ({ ...prev, bookings: [booking, ...prev.bookings] }));
      return booking;
    };

    const payBooking: Store['payBooking'] = (bookingId, method, amount) => {
      const payment: Payment = {
        id: uid(),
        bookingId,
        method,
        amount,
        reference: reference(),
        createdAt: Date.now(),
      };
      update((prev) => ({
        ...prev,
        payments: [payment, ...prev.payments],
        bookings: prev.bookings.map((b) =>
          b.id === bookingId ? { ...b, status: 'paid', paymentId: payment.id } : b
        ),
      }));
      return payment;
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
      cancelBooking: (id) =>
        update((prev) => ({
          ...prev,
          bookings: prev.bookings.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)),
        })),
      payBooking,
      sendMessage,
      ensureThread: (professionalId) =>
        update((prev) =>
          prev.threads[professionalId]
            ? prev
            : { ...prev, threads: { ...prev.threads, [professionalId]: { professionalId, messages: [] } } }
        ),
      unreadThreads: Object.values(data.threads).filter((t) => t.messages.length > 0).length,
    };
  }, [data, ready, update]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useStore must be used inside <AppProvider>');
  return ctx;
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'mtn', label: 'MTN Mobile Money', hint: 'Paiement depuis votre compte MoMo' },
  { id: 'airtel', label: 'Airtel Money', hint: 'Paiement depuis votre compte Airtel' },
  { id: 'especes', label: 'Espèces', hint: "Vous réglez directement le professionnel" },
];

export function paymentMethodLabel(id: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}
