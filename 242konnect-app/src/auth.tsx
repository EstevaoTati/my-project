import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  hashPassword,
  passwordProblem,
  verifyPassword,
  type StoredSecret,
} from './credentials';
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY,
  DEFAULT_LOCATION,
  formatStored,
  isCompleteNumber,
  normalizeNational,
  toE164,
  type CountryCode,
  type Location,
} from './countries';
import {
  canSendOtp,
  checkCode,
  otpProvider,
  OTP_UNAVAILABLE_MESSAGE,
  requestCode,
  type OtpDelivery,
} from './otpClient';

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
  /**
   * Canonical number: dial code plus national digits, e.g. "242061234567".
   * One unambiguous string across countries, and the identity the account is
   * keyed on. Use `formatStored` to display it.
   */
  phone: string;
  /** Which numbering plan `phone` belongs to, so it can be edited back. */
  phoneCountry: CountryCode;
  /** Where the person is. Congo uses a city; the US uses a state and a city. */
  location: Location;
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
  /** National digits as typed; combined with `phoneCountry` on submission. */
  phone: string;
  phoneCountry: CountryCode;
  email: string;
  location: Location;
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

/**
 * The account as written to storage. The password is never among these fields:
 * only a salt and a hash, so reading the store does not hand over credentials.
 */
type StoredAccount = Account & { secret: StoredSecret };

const ACCOUNTS_KEY = '242k.accounts';
const SESSION_KEY = '242k.session';
/**
 * Set the first time the app finishes launching. The directives route the very
 * first open to "Commencer" and every later open straight to Connexion (or the
 * dashboard), so that distinction has to survive a restart.
 */
const LAUNCHED_KEY = '242k.launched';

export const OTP_LENGTH = 6;

/** Re-exported so screens don't need to know where the verification service lives. */
export { canSendOtp, otpProvider, OTP_UNAVAILABLE_MESSAGE };
export { MIN_PASSWORD, passwordProblem, passwordStrength } from './credentials';
/**
 * Numbers are international now, so display goes through the country-aware
 * helper. The old Congo-only `formatPhone`/`normalizePhone`/`PHONE_LENGTH` are
 * gone rather than kept as aliases: leaving them would let a nine-digit
 * assumption creep back in.
 */
export { formatStored, fromE164 } from './countries';

/**
 * A ready-made account for shared preview builds, enabled by
 * `EXPO_PUBLIC_DEMO_ACCOUNT=1` and absent from any build without it.
 *
 * Sign-up needs a code that only exists in an e-mail, which is right but leaves
 * a tester on a link with no way in — and inside a Claude Artifact, whose
 * content policy blocks every external host, no way in at all. This is the way
 * in: a pre-existing account someone signs into normally.
 *
 * It fakes nothing. It is not an OTP bypass and does not touch verification;
 * it is an account that already exists, exactly like the demo login on any
 * product. Creating a *new* account still requires a real code by e-mail.
 */
export const DEMO_ENABLED = process.env.EXPO_PUBLIC_DEMO_ACCOUNT === '1';

export const DEMO_CREDENTIALS = { phone: '060000000', password: 'Demo2024' };

/** Canonical form of the demo number, so it matches like any other account. */
const DEMO_PHONE = toE164(DEMO_CREDENTIALS.phone, 'CG');

/**
 * Built rather than declared, because the password has to be hashed and hashing
 * is async. The demo account is stored exactly like a real one — no plaintext
 * shortcut — so signing into it exercises the same code path a real account does.
 */
async function buildDemoAccount(): Promise<StoredAccount> {
  return {
    phone: DEMO_PHONE,
    phoneCountry: 'CG',
    email: 'demo@242konnect.cg',
    name: 'Compte Démo',
    location: { country: 'CG', city: 'Pointe-Noire' },
    secret: await hashPassword(DEMO_CREDENTIALS.password),
    bio: "Compte de démonstration pour tester l'application.",
    profiles: ['particulier'],
    activeProfile: 'particulier',
    particulier: {
      address: 'Avenue Charles de Gaulle, Pointe-Noire',
      addressReference: 'En face de la pharmacie du Centre',
      interests: ['Maison', 'Automobile'],
    },
    createdAt: 0,
  };
}

/** Shown when the device has no room left for the account data. */
export const STORAGE_FULL_MESSAGE =
  "La mémoire de cette application est pleine sur cet appareil. Choisissez une photo de profil plus légère, ou libérez de l'espace, puis réessayez.";

/** The refusal the spec dictates, quoted rather than paraphrased. */
export const DUPLICATE_ACCOUNT_MESSAGE =
  'Ce numéro de téléphone ou cette adresse e-mail est déjà associé(e) à un compte 242Konnect. Veuillez vous connecter ou utiliser la procédure de récupération de compte.';


export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/** Where a verification code was sent, so the OTP screen can say so. */
export type OtpChannel = 'sms' | 'email';

export type PendingSignUp = SignUpDraft & {
  /**
   * Which service mailed the code, and how long it stays valid. Not the code:
   * that exists only in the user's inbox and in the service that issued it, so
   * nothing on this device — and nothing on this screen — can reveal it.
   */
  delivery: OtpDelivery;
  /**
   * Set once the code has been accepted. The account still does not exist:
   * the password is chosen after this point, which is the order the founder
   * asked for — Informations, Vérification, Création du mot de passe, Compte
   * créé. Collecting the password first is what produced a verification e-mail
   * that said nothing about the password the screen was already demanding.
   */
  verified: boolean;
  /** The canonical number, computed once the draft is accepted. */
  storedPhone: string;
};

type AuthState = {
  account: Account | null;
  /** True until the stored session has been read, so we don't flash a form. */
  restoring: boolean;
  /** Set once sign-up details are accepted and a code is awaiting entry. */
  pending: PendingSignUp | null;
  /** Validates the whole draft and issues a code; no account is created yet. */
  startSignUp: (draft: SignUpDraft) => Promise<void>;
  /** Checks the code and moves on to choosing a password. No account yet. */
  confirmSignUp: (code: string) => Promise<void>;
  /** Creates the account with the chosen password. The last step. */
  completeSignUp: (password: string) => Promise<void>;
  /** Issues a fresh code for the pending sign-up. */
  resendCode: () => Promise<void>;
  cancelSignUp: () => void;
  signIn: (input: { identifier: string; password: string }) => Promise<void>;
  /** Sends a code to the address on file so a forgotten password can be reset. */
  startPasswordReset: (identifier: string) => Promise<{ email: string }>;
  /** Checks that code and sets the new password. */
  completePasswordReset: (code: string, password: string) => Promise<void>;
  /** Set while a reset is in progress, so the navigator can show its screens. */
  resetting: { email: string; phone: string; verified: boolean } | null;
  cancelPasswordReset: () => void;
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

/**
 * A write that turns a quota failure into something a person can act on.
 *
 * On web AsyncStorage is localStorage, so a large avatar surfaces as a
 * `QuotaExceededError` whose own message is "Storage Full" — which is what the
 * founder saw, with nothing to do about it. Photos are bounded in `photo.ts`;
 * this is the backstop and, more importantly, the explanation.
 */
async function setItemChecked(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/quota|storage|full/i.test(message)) throw new Error(STORAGE_FULL_MESSAGE);
    throw e;
  }
}

/**
 * A fixed salt/hash used only to spend the same work when no account matched.
 *
 * Without it, an unknown identifier returns immediately while a known one pays
 * for a hash, and the difference is measurable — which turns sign-in into a way
 * to test whether a number is registered.
 */
const DECOY_SECRET = {
  salt: '242konnect-decoy',
  hash: '0'.repeat(64),
};

/**
 * Finds an account by phone number or e-mail (§3.2 allows either).
 *
 * Numbers are matched on the canonical form, and a bare national number is
 * tried against every served country — someone typing "06 123 45 67" is not
 * going to type their dial code first.
 */
async function findAccount(identifier: string): Promise<StoredAccount | undefined> {
  const raw = identifier.trim().toLowerCase();
  const digits = identifier.replace(/\D/g, '');
  const accounts = await readAccounts();

  const byEmail = accounts.find((a) => a.email === raw);
  if (byEmail) return byEmail;
  if (!digits) return undefined;

  return accounts.find((a) => {
    if (a.phone === digits) return true;
    // Typed without the dial code.
    return COUNTRY_CODES.some((code: CountryCode) => toE164(digits, code) === a.phone);
  });
}

async function readAccounts(): Promise<StoredAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

/**
 * Puts the demo account in the roster on preview builds, once.
 *
 * Re-added if missing but never overwritten, so a tester who edits its profile
 * keeps those edits across reloads.
 */
async function seedDemoAccount(): Promise<void> {
  if (!DEMO_ENABLED) return;
  try {
    const accounts = await readAccounts();
    if (accounts.some((a) => a.phone === DEMO_PHONE)) return;
    const demo = await buildDemoAccount();
    await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, demo]));
  } catch {
    // A tester without storage is already broken in more visible ways.
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [firstLaunch, setFirstLaunch] = useState(false);
  const [pending, setPending] = useState<PendingSignUp | null>(null);
  const [resetting, setResetting] = useState<AuthState['resetting']>(null);

  useEffect(() => {
    (async () => {
      try {
        await seedDemoAccount();
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
    if (next) await setItemChecked(SESSION_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(SESSION_KEY);
    // Only after the write succeeds. Updating state first is what made a failed
    // write look like a save that silently undid itself on the next launch.
    setAccount(next);
  }, []);

  /**
   * Writes an updated account to both the roster and the live session.
   *
   * Storage first, memory second, and both writes before either is announced.
   * The previous order set React state before the write, so a full quota left
   * the edit on screen and nowhere else — which is exactly the "changes not
   * saved" the founder reported, with "Storage Full" as its other face.
   */
  const persistAccount = useCallback(
    async (next: Account) => {
      // The stored record also holds the password, so merge into it rather than
      // replacing the row with a password-less copy — that would lock the user out.
      const accounts = await readAccounts();
      const merged = accounts.map((a) => (a.phone === next.phone ? { ...a, ...next } : a));
      await setItemChecked(ACCOUNTS_KEY, JSON.stringify(merged));
      await persistSession(next);
    },
    [persistSession]
  );

  const startSignUp = useCallback<AuthState['startSignUp']>(
    async (draft) => {
      const mail = draft.email.trim().toLowerCase();
      const country = draft.phoneCountry ?? DEFAULT_COUNTRY;
      const stored = toE164(draft.phone, country);

      // Shared identity rules. No password here any more: it is chosen after
      // verification, so the code can be requested before one exists.
      if (draft.name.trim().length < 2) throw new Error('Entrez votre nom complet.');
      if (!isCompleteNumber(draft.phone, country))
        throw new Error('Entrez un numéro de téléphone complet.');
      if (!isValidEmail(mail)) throw new Error('Entrez une adresse e-mail valide.');
      if (!draft.location?.city?.trim()) throw new Error('Indiquez votre ville.');
      if (draft.location.country === 'US' && !draft.location.state)
        throw new Error("Choisissez votre État.");

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
      if (accounts.some((a) => a.phone === stored || a.email === mail))
        throw new Error(DUPLICATE_ACCOUNT_MESSAGE);

      // Mailing the code can fail (offline, service down, nothing configured);
      // the sign-up must not look started if no code actually went out.
      const delivery = await requestCode(stored, mail, {
        name: draft.name.trim(),
        phone: stored,
        profile: draft.profile,
      });
      setPending({
        ...draft,
        name: draft.name.trim(),
        phoneCountry: country,
        email: mail,
        storedPhone: stored,
        delivery,
        verified: false,
      });
    },
    []
  );

  const confirmSignUp = useCallback<AuthState['confirmSignUp']>(
    async (code) => {
      if (!pending) throw new Error('Aucune inscription en cours.');
      // Always server-side: the device holds nothing to compare against, so
      // attempts are capped and the code expires where it was issued.
      await checkCode(pending.storedPhone, pending.email, code, pending.delivery);

      // Verified, but deliberately not created. The password comes next.
      setPending((prev) => (prev ? { ...prev, verified: true } : prev));
    },
    [pending]
  );

  const completeSignUp = useCallback<AuthState['completeSignUp']>(
    async (password) => {
      if (!pending) throw new Error('Aucune inscription en cours.');
      if (!pending.verified) throw new Error("Vérifiez d'abord le code reçu.");

      const problem = passwordProblem(password);
      if (problem) throw new Error(problem);

      const accounts = await readAccounts();
      // Re-check: another sign-up could have claimed the number or the address
      // while this one was being verified.
      if (accounts.some((a) => a.phone === pending.storedPhone || a.email === pending.email))
        throw new Error(DUPLICATE_ACCOUNT_MESSAGE);

      const created: StoredAccount = {
        phone: pending.storedPhone,
        phoneCountry: pending.phoneCountry,
        email: pending.email,
        name: pending.name,
        location: pending.location,
        secret: await hashPassword(password),
        avatar: pending.avatar,
        bio: pending.bio,
        profiles: [pending.profile],
        activeProfile: pending.profile,
        particulier: pending.particulier,
        prestataire: pending.prestataire,
        business: pending.business,
        createdAt: Date.now(),
      };
      await setItemChecked(ACCOUNTS_KEY, JSON.stringify([...accounts, created]));
      const { secret: _omit, ...safe } = created;
      setPending(null);
      await persistSession(safe);
    },
    [pending, persistSession]
  );

  const resendCode = useCallback(async () => {
    if (!pending) return;
    const delivery = await requestCode(pending.storedPhone, pending.email, {
      name: pending.name,
      phone: pending.storedPhone,
      profile: pending.profile,
    });
    setPending((prev) => (prev ? { ...prev, delivery } : prev));
  }, [pending]);

  const cancelSignUp = useCallback(() => setPending(null), []);

  const signIn = useCallback<AuthState['signIn']>(
    async ({ identifier, password }) => {
      const found = await findAccount(identifier);

      // Same message whether the account is unknown or the password is wrong —
      // saying which is wrong tells an attacker which numbers are registered,
      // which is exactly the "knowing the number should not be enough" the
      // correction note asks for. The hash is still computed when no account
      // matched, so the two paths take comparable time.
      const ok = found
        ? await verifyPassword(password, found.secret)
        : await verifyPassword(password, DECOY_SECRET).then(() => false);
      if (!found || !ok) throw new Error('Identifiant ou mot de passe incorrect.');

      const { secret: _omit, ...safe } = found;
      await persistSession(safe);
    },
    [persistSession]
  );

  /* ---------------------------------------------------------------- *
   * Forgotten passwords
   * ---------------------------------------------------------------- */

  const startPasswordReset = useCallback<AuthState['startPasswordReset']>(
    async (identifier) => {
      const found = await findAccount(identifier);
      // Deliberately the same outcome either way: confirming that an address is
      // unknown turns this screen into a way to enumerate accounts.
      if (!found) {
        setResetting(null);
        throw new Error(
          "Si un compte existe pour cet identifiant, un code vient d'être envoyé à l'adresse e-mail associée."
        );
      }
      await requestCode(found.phone, found.email, { name: found.name, phone: found.phone });
      setResetting({ email: found.email, phone: found.phone, verified: false });
      return { email: found.email };
    },
    []
  );

  const completePasswordReset = useCallback<AuthState['completePasswordReset']>(
    async (code, password) => {
      if (!resetting) throw new Error('Aucune réinitialisation en cours.');
      const problem = passwordProblem(password);
      if (problem) throw new Error(problem);

      const delivery: OtpDelivery = { provider: otpProvider === 'supabase' ? 'supabase' : 'api', expiresIn: 600 };
      await checkCode(resetting.phone, resetting.email, code, delivery);

      const accounts = await readAccounts();
      const secret = await hashPassword(password);
      const next = accounts.map((a) => (a.phone === resetting.phone ? { ...a, secret } : a));
      await setItemChecked(ACCOUNTS_KEY, JSON.stringify(next));
      setResetting(null);
    },
    [resetting]
  );

  const cancelPasswordReset = useCallback(() => setResetting(null), []);

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
      completeSignUp,
      resendCode,
      cancelSignUp,
      signIn,
      signOut,
      startPasswordReset,
      completePasswordReset,
      cancelPasswordReset,
      resetting,
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
      completeSignUp,
      resendCode,
      cancelSignUp,
      signIn,
      signOut,
      startPasswordReset,
      completePasswordReset,
      cancelPasswordReset,
      resetting,
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
