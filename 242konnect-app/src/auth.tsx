import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Accounts, stored on the device.
 *
 * There is no backend yet, so an account created here lives in AsyncStorage on
 * this device and nowhere else — it survives closing the app, but it does not
 * exist on any server and cannot be used from a second phone. Everything below
 * is shaped so that swapping in a real API means replacing the three functions
 * that touch storage, not rewriting the screens.
 *
 * Identity is the phone number, not an email. 242Konnect serves Pointe-Noire,
 * where a mobile number is how people are reached and identified — +242 is
 * Congo-Brazzaville's dialing code, and the product is named after it.
 */

export type AccountRole = 'client' | 'pro';

export type Account = {
  /** Local number without the +242 prefix, digits only. */
  phone: string;
  name: string;
  role: AccountRole;
  /** Profile photo as a data URI. Kept small so it fits in AsyncStorage. */
  avatar?: string;
  bio?: string;
  /** For professionals: which trade they offer, from the catalogue. */
  tradeId?: string;
};

/** What someone can change after signing up. The phone number is the identity. */
export type ProfileEdits = Partial<Pick<Account, 'name' | 'avatar' | 'bio' | 'tradeId'>>;

type StoredAccount = Account & { password: string };

const ACCOUNTS_KEY = '242k.accounts';
const SESSION_KEY = '242k.session';

/** Congolese mobile numbers are nine digits, conventionally starting 0. */
export const PHONE_LENGTH = 9;
export const MIN_PASSWORD = 6;

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '').slice(0, PHONE_LENGTH);
}

/** "061234567" -> "06 123 45 67", the way it's written locally. */
export function formatPhone(digits: string): string {
  const d = normalizePhone(digits);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(' ');
}

type AuthState = {
  account: Account | null;
  /** True until the stored session has been read, so we don't flash the welcome screen. */
  restoring: boolean;
  signUp: (input: { name: string; phone: string; password: string; role: AccountRole }) => Promise<void>;
  signIn: (input: { phone: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (edits: ProfileEdits) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function readAccounts(): Promise<StoredAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        if (raw) setAccount(JSON.parse(raw) as Account);
      } catch {
        // A corrupt session is not worth blocking sign-in over; start signed out.
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  const persistSession = useCallback(async (next: Account | null) => {
    setAccount(next);
    if (next) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const signUp = useCallback<AuthState['signUp']>(
    async ({ name, phone, password, role }) => {
      const digits = normalizePhone(phone);
      if (name.trim().length < 2) throw new Error('Entrez votre nom complet.');
      if (digits.length !== PHONE_LENGTH) throw new Error(`Le numéro doit contenir ${PHONE_LENGTH} chiffres.`);
      if (password.length < MIN_PASSWORD)
        throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);

      const accounts = await readAccounts();
      if (accounts.some((a) => a.phone === digits))
        throw new Error('Un compte existe déjà avec ce numéro. Connectez-vous.');

      const created: StoredAccount = { phone: digits, name: name.trim(), role, password };
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, created]));
      const { password: _omit, ...safe } = created;
      await persistSession(safe);
    },
    [persistSession]
  );

  const signIn = useCallback<AuthState['signIn']>(
    async ({ phone, password }) => {
      const digits = normalizePhone(phone);
      const accounts = await readAccounts();
      const found = accounts.find((a) => a.phone === digits);
      // Same message whether the number is unknown or the password is wrong —
      // saying which one is wrong tells an attacker which numbers are registered.
      if (!found || found.password !== password) throw new Error('Numéro ou mot de passe incorrect.');
      const { password: _omit, ...safe } = found;
      await persistSession(safe);
    },
    [persistSession]
  );

  const signOut = useCallback(() => persistSession(null), [persistSession]);

  const updateProfile = useCallback<AuthState['updateProfile']>(
    async (edits) => {
      if (!account) throw new Error('Aucun compte connecté.');
      if (edits.name !== undefined && edits.name.trim().length < 2)
        throw new Error('Entrez votre nom complet.');

      const next: Account = { ...account, ...edits, name: edits.name?.trim() ?? account.name };
      // The stored record also holds the password, so merge into it rather than
      // replacing the row with a password-less copy — that would lock the user out.
      const accounts = await readAccounts();
      await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(accounts.map((a) => (a.phone === account.phone ? { ...a, ...next } : a)))
      );
      await persistSession(next);
    },
    [account, persistSession]
  );

  const value = useMemo<AuthState>(
    () => ({ account, restoring, signUp, signIn, signOut, updateProfile }),
    [account, restoring, signUp, signIn, signOut, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
