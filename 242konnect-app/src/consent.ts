/**
 * Consent, the provider contract, and the privacy requests that go with them.
 *
 * Parcours Client §10 asks for a consent that is *traceable*: the terms and the
 * privacy policy readable before the account is activated, the mandatory
 * consents kept apart from the optional marketing one, and the date, time and
 * version of each acceptance recorded. Parcours Prestataire §06 adds a contract
 * that must be read, accepted and signed, with the version, the time, the
 * "adresse technique" and a proof of signature kept — and re-accepted whenever
 * an important new version is published.
 *
 * None of that can be trusted from a phone. The phone says what it was shown
 * and what was ticked; `public.consent_records` stamps the time, the user and
 * the IP address itself (see the migration), and accepts inserts only — a
 * consent can be superseded by a newer row, never edited away.
 *
 * The documents live here rather than on a website so that the version shown is
 * by construction the version recorded. Changing a text without changing its
 * version is the one mistake this file exists to prevent: bump the constant and
 * every account is asked again (`needsReacceptance`).
 */

import { T } from './i18n';
import { supabaseConfigured, supabaseFetch, type SupabaseSession } from './supabase';

export const TERMS_VERSION = '2026-09';
export const PRIVACY_VERSION = '2026-09';
export const PROVIDER_CONTRACT_VERSION = '2026-09';

export type ConsentKind = 'terms' | 'privacy' | 'marketing' | 'provider_contract';

/** What the device remembers; the server's own row is the authoritative copy. */
export type ConsentRecord = {
  kind: ConsentKind;
  version: string;
  granted: boolean;
  /** Provider contract only: the full name typed as a signature. */
  signature?: string;
  /** Device time, for display. The server stamps its own. */
  at: number;
  /** Whether `public.consent_records` holds this row yet. */
  recorded: boolean;
};

export type LegalSection = { title: string; body: string };
export type LegalDocument = { id: ConsentKind; title: string; version: string; sections: LegalSection[] };

export const TERMS: LegalDocument = {
  id: 'terms',
  title: T("Conditions d'utilisation"),
  version: TERMS_VERSION,
  sections: [
    {
      title: T('Le service'),
      body: T("242Konnect met en relation des clients et des prestataires vérifiés. Toute demande, tout échange, tout devis et tout paiement passent par l'application."),
    },
    {
      title: T('Votre compte'),
      body: T("Un numéro de téléphone et une adresse e-mail n'appartiennent qu'à un seul compte. Les informations fournies doivent être exactes. Le nom, le téléphone et le pays vérifiés ne se modifient qu'avec le support."),
    },
    {
      title: T('Paiements protégés'),
      body: T("242Konnect conserve le paiement jusqu'à la validation du service. Les paiements et négociations hors plateforme sont interdits et peuvent conduire à une suspension après contrôle."),
    },
    {
      title: T('Annulations et litiges'),
      body: T("Avant acceptation, une annulation est remboursée intégralement. Après acceptation, le remboursement dépend du préavis et du travail effectué. Un litige gèle les fonds pendant l'examen du contrat, du chat, des horaires et des preuves."),
    },
  ],
};

export const PRIVACY: LegalDocument = {
  id: 'privacy',
  title: T('Politique de confidentialité'),
  version: PRIVACY_VERSION,
  sections: [
    {
      title: T('Localisation'),
      body: T("Utilisée pour proposer les services de votre pays et de votre ville, et seulement après votre autorisation. Votre adresse exacte reste privée jusqu'à l'acceptation d'une mission."),
    },
    {
      title: T('Photos et documents'),
      body: T("Votre photo de profil est visible des autres utilisateurs. Les pièces justificatives d'un prestataire ne servent qu'à sa vérification et ne sont jamais publiées."),
    },
    {
      title: T('Coordonnées'),
      body: T("Votre téléphone et votre e-mail ne sont jamais affichés publiquement. Les échanges passent par la messagerie de l'application."),
    },
    {
      title: T('Stockage local et mesure'),
      body: T("L'application conserve votre session et vos préférences sur l'appareil. Aucune technologie de mesure publicitaire n'est utilisée."),
    },
    {
      title: T('Vos droits'),
      body: T("Vous pouvez consulter vos consentements, retirer l'accord marketing et demander la correction ou la suppression de vos données depuis Profil › Confidentialité."),
    },
  ],
};

export const PROVIDER_CONTRACT: LegalDocument = {
  id: 'provider_contract',
  title: T('Contrat Prestataire'),
  version: PROVIDER_CONTRACT_VERSION,
  sections: [
    {
      title: T('Responsabilités'),
      body: T("Vous réalisez les missions acceptées avec soin, dans les délais convenus, et vous respectez les règles de sécurité de votre métier."),
    },
    {
      title: T('Exactitude des informations'),
      body: T("Votre identité, vos services, vos prix et vos pièces sont exacts. Une information fausse entraîne le refus ou la suspension du profil."),
    },
    {
      title: T('Paiements et frais'),
      body: T("242Konnect collecte le paiement du client et vous le verse après validation, déduction faite de la commission de 12 % et des frais de versement. Aucun paiement hors plateforme."),
    },
    {
      title: T('Confidentialité'),
      body: T("Les coordonnées et l'adresse exacte du client ne vous sont communiquées qu'après acceptation, et uniquement pour la mission."),
    },
    {
      title: T('Annulations et litiges'),
      body: T("Les annulations répétées ou tardives affectent votre score. En cas de litige, 242Konnect examine le contrat, le chat, les horaires et les preuves avant toute décision, et vous pouvez répondre."),
    },
  ],
};

/**
 * Who answers for personal data. Set `EXPO_PUBLIC_PRIVACY_CONTACT` at build
 * time; until then the screen says the contact is to be published, rather than
 * printing an address nobody reads.
 */
export const PRIVACY_CONTACT = (process.env.EXPO_PUBLIC_PRIVACY_CONTACT ?? '').trim();

/** The current version of each document, for the re-acceptance check. */
export const CURRENT_VERSIONS: Record<Exclude<ConsentKind, 'marketing'>, string> = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
  provider_contract: PROVIDER_CONTRACT_VERSION,
};

/** Latest record of each kind, newest wins. */
export function latestConsents(records: ConsentRecord[] = []): Partial<Record<ConsentKind, ConsentRecord>> {
  const out: Partial<Record<ConsentKind, ConsentRecord>> = {};
  for (const r of records) if (!out[r.kind] || out[r.kind]!.at <= r.at) out[r.kind] = r;
  return out;
}

/**
 * Documents whose accepted version is not the current one — "une nouvelle
 * version importante doit être acceptée à nouveau".
 */
export function needsReacceptance(
  records: ConsentRecord[] = [],
  isProvider: boolean
): Exclude<ConsentKind, 'marketing'>[] {
  const latest = latestConsents(records);
  const kinds: Exclude<ConsentKind, 'marketing'>[] = isProvider
    ? ['terms', 'privacy', 'provider_contract']
    : ['terms', 'privacy'];
  return kinds.filter((k) => !latest[k]?.granted || latest[k]!.version !== CURRENT_VERSIONS[k]);
}

/**
 * Sends records to `public.consent_records`. Returns the list with `recorded`
 * set on the ones the server accepted. Never throws: a consent that could not
 * be sent is kept on the device and sent again with the next sync.
 */
export async function recordConsents(
  session: SupabaseSession | null,
  records: ConsentRecord[]
): Promise<ConsentRecord[]> {
  const pending = records.filter((r) => !r.recorded);
  if (!session || !supabaseConfigured || pending.length === 0) return records;
  try {
    const response = await supabaseFetch(
      '/rest/v1/consent_records',
      {
        method: 'POST',
        // user_id, accepted_at and ip are deliberately absent: the server sets them.
        body: pending.map((r) => ({
          kind: r.kind,
          version: r.version,
          granted: r.granted,
          signature: r.signature ?? null,
        })),
        headers: { Prefer: 'return=minimal' },
      },
      session
    );
    if (!response.ok) return records;
    return records.map((r) => ({ ...r, recorded: true }));
  } catch {
    return records;
  }
}

export type DataRequestKind = 'correction' | 'deletion';

/** Files a correction or deletion request (Client §10). */
export async function requestDataChange(
  session: SupabaseSession | null,
  kind: DataRequestKind,
  details: string
): Promise<boolean> {
  if (!session || !supabaseConfigured) return false;
  try {
    const response = await supabaseFetch(
      '/rest/v1/data_requests',
      { method: 'POST', body: { kind, details }, headers: { Prefer: 'return=minimal' } },
      session
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * The consents already given, from the audit trail — so signing in on a new
 * device does not ask someone to accept documents they accepted elsewhere.
 * Empty on any failure: the gate then asks again, which is safe.
 */
export async function fetchConsents(session: SupabaseSession | null): Promise<ConsentRecord[]> {
  if (!session || !supabaseConfigured) return [];
  try {
    const response = await supabaseFetch(
      `/rest/v1/consent_records?user_id=eq.${encodeURIComponent(session.userId)}&select=kind,version,granted,signature,accepted_at&order=accepted_at.asc`,
      {},
      session
    );
    if (!response.ok) return [];
    const rows = (await response.json()) as {
      kind: ConsentKind;
      version: string;
      granted: boolean;
      signature: string | null;
      accepted_at: string;
    }[];
    return rows.map((r) => ({
      kind: r.kind,
      version: r.version,
      granted: r.granted,
      ...(r.signature ? { signature: r.signature } : {}),
      at: Date.parse(r.accepted_at),
      recorded: true,
    }));
  } catch {
    return [];
  }
}
