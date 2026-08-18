import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkCode, hasOtpApi, requestCode, type OtpDelivery } from './otpClient';

/**
 * Accounts, stored on the device.
 *
 * There is no backend yet, so an account created here lives in AsyncStorage on
 * this device and nowhere else. It survives closing the app, but it does not
 * exist on any server and cannot be used from a second phone. Everything below
 * is shaped so that swapping in a real API means replacing the functions that
 * touch storage, not rewriting the screens.
 *
 * Two rules come straight from the cahier des charges §9.10:
 *
 *  - **One account, several profiles.** A person has a single login — one phone
 *    number, one e-mail — and activates Particulier, Prestataire and/or
 *    Business on top of it. The spec is explicit that three separate accounts is
 *    the wrong shape: "l'utilisateur n'a qu'une seule connexion et peut changer
 *    de profil depuis son espace personnel".
 *  - **Uniqueness.** A phone number and an e-mail each belong to exactly one
 *    account, and the refusal message is quoted from the spec.
 *
 * The uniqueness check here only sees accounts on this device. Real uniqueness
 * needs a shared database — see docs/decisions.
 */

export type ProfileKind = 'particulier' | 'prestataire' | 'business';

export const PROFILE_LABELS: Record<ProfileKind, string> = {
  particulier: 'Particulier',
  prestataire: 'Prestataire',
  business: 'Business',
};

/**
 * Per-profile detail. §2.2 gives each account type a different required set, so
 * they are separate objects rather than a pile of optional fields on Account:
 * a Business has no date of birth, a Particulier has no RCCM, and flattening
 * them would make "is this profile complete?" impossible to answer.
 */
export type ParticulierDetails = {
  /** §2.2: adresse complète + référence de l'adresse (how to find it locally). */
  address: string;
  addressReference: string;
  interests: string[];
};

export type PrestataireDetails = {
  /** ISO date. §2.2 forbids under-16s. */
  birthDate: string;
  tradeId: string;
  zone: string;
  hourlyRate: number;
  formations: string;
  diplomas: string;
  experience: string;
  /** Names of the pièces justificatives supplied; validation is 242Konnect's. */
  documents: string[];
  /** Awarded by 242Konnect after checking documents (§7.6) — never self-set. */
  verified: boolean;
};

export type BusinessDetails = {
  companyName: string;
  /** Data URI, like the avatar. */
  logo?: string;
  rccm: string;
  nif: string;
  sector: string;
  website?: string;
  address: string;
};

export const MIN_PRESTATAIRE_AGE = 16;

export const BUSINESS_SECTORS = [
  'Hôtellerie & Restauration',
  'Commerce & Distribution',
  'Industrie',
  'BTP & Immobilier',
  'Santé',
  'Éducation',
  'Banque & Assurance',
  'Transport & Logistique',
  'Administration publique',
  'ONG & Association',
  'Autre',
];

export const INTERESTS = [
  'Maison', 'Bricolage', 'Automobile', 'Beauté', 'Santé', 'Éducation',
  'Événementiel', 'Informatique', 'Jardinage', 'Nettoyage',
];

export type Account = {
  /** Local number without the +242 prefix, digits only. Part of the identity. */
  phone: string;
  /** The other half of the identity (§2.2 — OTP goes to one or the other). */
  email: string;
  name: string;
  /** Profile photo as a data URI. Kept small so it fits in AsyncStorage. */
  avatar?: string;
  bio?: string;
  /** Which profiles this one account has activated (§9.10). */
  profiles: ProfileKind[];
  /** The profile currently in use; switched from the Profil tab. */
  activeProfile: ProfileKind;
  /** Populated only for the profiles this account has activated. */
  particulier?: ParticulierDetails;
  prestataire?: PrestataireDetails;
  business?: BusinessDetails;
  createdAt: number;
};

/** What someone can change afterwards. Phone and e-mail are the identity. */
export type ProfileEdits = Partial<
  Pick<Account, 'name' | 'avatar' | 'bio' | 'particulier' | 'prestataire' | 'business'>
>;

/** Everything collected across the sign-up steps, before the code is confirmed. */
export type SignUpDraft = {
  name: string;
  phone: string;
  email: string;
  password: string;
  profile: ProfileKind;
  channel: OtpChannel;
  avatar?: string;
  bio?: string;
  particulier?: ParticulierDetails;
  prestataire?: PrestataireDetails;
  business?: BusinessDetails;
};

/** Years between an ISO date and today. Used for the under-16 rule. */
export function ageFrom(isoDate: string): number | null {
  const born = new Date(isoDate);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}

type StoredAccount = Account & { password: string };

const ACCOUNTS_KEY = '242k.accounts';
const SESSION_KEY = '242k.session';
/**
 * Set the first time the app finishes launching. The directives route the very
 * first open to "Commencer" and every later open straight to Connexion (or the
 * dashboard), so that distinction has to survive a restart.
 */
const LAUNCHED_KEY = '242k.launched';

/** Congolese mobile numbers are nine digits, conventionally starting 0. */
export const PHONE_LENGTH = 9;
export const MIN_PASSWORD = 6;
export const OTP_LENGTH = 6;

/** Re-exported so screens don't need to know where the API lives. */
export { hasOtpApi };

/** The refusal the spec dictates, quoted rather than paraphrased. */
export const DUPLICATE_ACCOUNT_MESSAGE =
  'Ce numéro de téléphone ou cette adresse e-mail est déjà associé(e) à un compte 242Konnect. Veuillez vous connecter ou utiliser la procédure de récupération de compte.';

export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '').slice(0, PHONE_LENGTH);
}

/** "061234567" -> "06 123 45 67", the way it's written locally. */
export function formatPhone(digits: string): string {
  const d = normalizePhone(digits);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(' ');
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/** Where a verification code was sent, so the OTP screen can say so. */
export type OtpChannel = 'sms' | 'email';

export type PendingSignUp = SignUpDraft & {
  /**
   * How the code was delivered. With the API configured this is
   * `{ mode: 'email' }` and the code exists only in the message — nothing on the
   * device knows it. Without an API it is `{ mode: 'demo', code }`, shown on
   * screen behind a notice, because silently accepting any code would make the
   * verification look real while enforcing nothing.
   */
  delivery: OtpDelivery;
};

type AuthState = {
  account: Account | null;
  /** True until the stored session has been read, so we don't flash a form. */
  restoring: boolean;
  /** Set once sign-up details are accepted and a code is awaiting entry. */
  pending: PendingSignUp | null;
  /** Validates the whole draft and issues a code; no account is created yet. */
  startSignUp: (draft: SignUpDraft) => Promise<void>;
  /** Creates the account once the code matches. */
  confirmSignUp: (code: string) => Promise<void>;
  /** Issues a fresh code for the pending sign-up. */
  resendCode: () => Promise<void>;
  cancelSignUp: () => void;
  signIn: (input: { identifier: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (edits: ProfileEdits) => Promise<void>;
  /** Switches which profile is in use (§9.10). */
  switchProfile: (kind: ProfileKind) => Promise<void>;
  /** Activates an additional profile on the same account. */
  activateProfile: (kind: ProfileKind) => Promise<void>;
  /** True until the app has been opened once on this device. */
  firstLaunch: boolean;
  markLaunched: () => void;
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
  const [firstLaunch, setFirstLaunch] = useState(false);
  const [pending, setPending] = useState<PendingSignUp | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [raw, launched] = await Promise.all([
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(LAUNCHED_KEY),
        ]);
        if (raw) setAccount(JSON.parse(raw) as Account);
        setFirstLaunch(launched === null);
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

  /** Writes an updated account to both the roster and the live session. */
  const persistAccount = useCallback(
    async (next: Account) => {
      // The stored record also holds the password, so merge into it rather than
      // replacing the row with a password-less copy — that would lock the user out.
      const accounts = await readAccounts();
      await AsyncStorage.setItem(
        ACCOUNTS_KEY,
        JSON.stringify(accounts.map((a) => (a.phone === next.phone ? { ...a, ...next } : a)))
      );
      await persistSession(next);
    },
    [persistSession]
  );

  const startSignUp = useCallback<AuthState['startSignUp']>(
    async (draft) => {
      const digits = normalizePhone(draft.phone);
      const mail = draft.email.trim().toLowerCase();

      // Shared identity rules.
      if (draft.name.trim().length < 2) throw new Error('Entrez votre nom complet.');
      if (digits.length !== PHONE_LENGTH)
        throw new Error(`Le numéro doit contenir ${PHONE_LENGTH} chiffres.`);
      if (!isValidEmail(mail)) throw new Error('Entrez une adresse e-mail valide.');
      if (draft.password.length < MIN_PASSWORD)
        throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);

      // Per-profile rules — §2.2 asks for a different set from each.
      if (draft.profile === 'particulier') {
        const d = draft.particulier;
        if (!d?.address.trim()) throw new Error('Indiquez votre adresse complète.');
        if (!d?.addressReference.trim())
          throw new Error("Indiquez une référence d'adresse (un repère pour vous trouver).");
      }

      if (draft.profile === 'prestataire') {
        const d = draft.prestataire;
        // "photo de profil obligatoire" is stated for prestataires only.
        if (!draft.avatar) throw new Error('Une photo de profil est obligatoire pour un prestataire.');
        if (!d?.birthDate) throw new Error('Indiquez votre date de naissance.');
        const age = ageFrom(d.birthDate);
        if (age === null) throw new Error('Date de naissance invalide (JJ/MM/AAAA).');
        if (age < MIN_PRESTATAIRE_AGE)
          throw new Error(
            `L'inscription des prestataires est réservée aux personnes de ${MIN_PRESTATAIRE_AGE} ans et plus.`
          );
        if (!d.tradeId) throw new Error('Choisissez votre métier.');
        if (!d.zone.trim()) throw new Error("Indiquez votre zone d'intervention.");
        if (!(d.hourlyRate > 0)) throw new Error('Indiquez votre tarif horaire.');
        if (!draft.bio?.trim()) throw new Error('Rédigez une courte biographie.');
      }

      if (draft.profile === 'business') {
        const d = draft.business;
        if (!d?.companyName.trim()) throw new Error('Indiquez la raison sociale.');
        if (!d?.rccm.trim()) throw new Error('Indiquez le numéro RCCM.');
        if (!d?.nif.trim()) throw new Error('Indiquez le NIF.');
        if (!d?.sector.trim()) throw new Error("Choisissez le secteur d'activité.");
        if (!d?.address.trim()) throw new Error("Indiquez l'adresse de l'entreprise.");
      }

      // §9.10: a phone number and an e-mail each belong to one account only.
      const accounts = await readAccounts();
      if (accounts.some((a) => a.phone === digits || a.email === mail))
        throw new Error(DUPLICATE_ACCOUNT_MESSAGE);

      // Asking the API to mail the code can fail (offline, service down); the
      // sign-up must not look started if no code actually went out.
      const delivery = await requestCode(digits, mail);
      setPending({ ...draft, name: draft.name.trim(), phone: digits, email: mail, delivery });
    },
    []
  );

  const confirmSignUp = useCallback<AuthState['confirmSignUp']>(
    async (code) => {
      if (!pending) throw new Error('Aucune inscription en cours.');
      // Server-side when an API is configured, so attempts are capped and the
      // code expires; on-device only in demo mode.
      await checkCode(pending.phone, code, pending.delivery);

      const accounts = await readAccounts();
      // Re-check: another profile could have claimed the number while the code
      // was being entered.
      if (accounts.some((a) => a.phone === pending.phone || a.email === pending.email))
        throw new Error(DUPLICATE_ACCOUNT_MESSAGE);

      const created: StoredAccount = {
        phone: pending.phone,
        email: pending.email,
        name: pending.name,
        password: pending.password,
        avatar: pending.avatar,
        bio: pending.bio,
        profiles: [pending.profile],
        activeProfile: pending.profile,
        particulier: pending.particulier,
        prestataire: pending.prestataire,
        business: pending.business,
        createdAt: Date.now(),
      };
      await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, created]));
      const { password: _omit, ...safe } = created;
      setPending(null);
      await persistSession(safe);
    },
    [pending, persistSession]
  );

  const resendCode = useCallback(async () => {
    if (!pending) return;
    const delivery = await requestCode(pending.phone, pending.email);
    setPending((prev) => (prev ? { ...prev, delivery } : prev));
  }, [pending]);

  const cancelSignUp = useCallback(() => setPending(null), []);

  const signIn = useCallback<AuthState['signIn']>(
    async ({ identifier, password }) => {
      // §3.2: sign in with either the phone number or the e-mail address.
      const raw = identifier.trim().toLowerCase();
      const digits = normalizePhone(identifier);
      const accounts = await readAccounts();
      const found = accounts.find(
        (a) => (digits.length === PHONE_LENGTH && a.phone === digits) || a.email === raw
      );
      // Same message whether the account is unknown or the password is wrong —
      // saying which one is wrong tells an attacker which numbers are registered.
      if (!found || found.password !== password)
        throw new Error('Identifiant ou mot de passe incorrect.');
      const { password: _omit, ...safe } = found;
      await persistSession(safe);
    },
    [persistSession]
  );

  const signOut = useCallback(() => persistSession(null), [persistSession]);

  const markLaunched = useCallback(() => {
    setFirstLaunch(false);
    AsyncStorage.setItem(LAUNCHED_KEY, '1').catch(() => {});
  }, []);

  const updateProfile = useCallback<AuthState['updateProfile']>(
    async (edits) => {
      if (!account) throw new Error('Aucun compte connecté.');
      if (edits.name !== undefined && edits.name.trim().length < 2)
        throw new Error('Entrez votre nom complet.');
      await persistAccount({ ...account, ...edits, name: edits.name?.trim() ?? account.name });
    },
    [account, persistAccount]
  );

  const switchProfile = useCallback<AuthState['switchProfile']>(
    async (kind) => {
      if (!account) throw new Error('Aucun compte connecté.');
      if (!account.profiles.includes(kind))
        throw new Error("Ce profil n'est pas encore activé sur votre compte.");
      await persistAccount({ ...account, activeProfile: kind });
    },
    [account, persistAccount]
  );

  const activateProfile = useCallback<AuthState['activateProfile']>(
    async (kind) => {
      if (!account) throw new Error('Aucun compte connecté.');
      if (account.profiles.includes(kind)) {
        await persistAccount({ ...account, activeProfile: kind });
        return;
      }
      await persistAccount({
        ...account,
        profiles: [...account.profiles, kind],
        activeProfile: kind,
      });
    },
    [account, persistAccount]
  );

  const value = useMemo<AuthState>(
    () => ({
      account,
      restoring,
      pending,
      startSignUp,
      confirmSignUp,
      resendCode,
      cancelSignUp,
      signIn,
      signOut,
      updateProfile,
      switchProfile,
      activateProfile,
      firstLaunch,
      markLaunched,
    }),
    [
      account,
      restoring,
      pending,
      startSignUp,
      confirmSignUp,
      resendCode,
      cancelSignUp,
      signIn,
      signOut,
      updateProfile,
      switchProfile,
      activateProfile,
      firstLaunch,
      markLaunched,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
