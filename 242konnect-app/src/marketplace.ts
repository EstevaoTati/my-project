/**
 * The marketplace, on the server.
 *
 * Everything transactional used to live on one phone, so a prestataire could
 * never receive what a client sent. These calls reach the four tables of
 * `supabase/migrations/20261001010000_marketplace.sql`:
 *
 *   provider_listings        the directory
 *   service_requests         requests and missions
 *   service_request_private  the exact address, released on acceptance
 *   request_messages         the chat attached to a request
 *
 * The app never moves a request by writing to it. It asks `request_action`,
 * which checks who is calling and what state the request is in — so the rules
 * (pay before sending, one acceptance, no release before completion, frozen
 * funds in a dispute) hold even against a modified client.
 */

import type { Account } from './auth';
import type { Pricing } from './pricing';
import type { MissionDuration, MissionStage } from './store';
import { supabaseConfigured, supabaseFetch, type SupabaseSession } from './supabase';

/** Off when the build has no Supabase — the test builds, and nothing else. */
export const marketplaceEnabled = supabaseConfigured;

export type ListingStatus = 'pending' | 'approved' | 'refused';

export type Listing = {
  id: string;
  fullName: string;
  /** Only fetched for a single listing; the directory omits it to stay light. */
  avatar?: string;
  tradeId: string;
  zone: string;
  city: string;
  country: string;
  pricing?: Pricing;
  durations: string[];
  bio: string;
  status: ListingStatus;
  refusalReason?: string;
};

export type RequestStatus =
  | 'draft'
  | 'sent'
  | 'refused'
  | 'accepted'
  | 'validated'
  | 'disputed'
  | 'cancelled';

export type RemoteRequest = {
  id: string;
  clientId: string;
  providerId: string;
  clientName: string;
  tradeId: string;
  description: string;
  zoneHint: string;
  slot: string;
  duration: MissionDuration;
  contractAcceptedAt?: string;
  amount: number;
  currency: 'FCFA' | 'USD';
  idempotencyKey: string;
  status: RequestStatus;
  stage?: MissionStage;
  stageAt: Partial<Record<MissionStage, string>>;
  paymentMethod?: string;
  paymentRef?: string;
  paidAt?: string;
  responseDeadline?: string;
  refundStatus: 'none' | 'full' | 'under_review';
  dispute?: { reason: string; outcome: string; details: string };
  createdAt: string;
};

export type RemoteMessage = { id: number; senderId: string; body: string; createdAt: string };

/** A request past its 24 h response window with no answer (Commande §07). */
export function isExpired(r: RemoteRequest): boolean {
  return r.status === 'sent' && !!r.responseDeadline && Date.parse(r.responseDeadline) < Date.now();
}

/** Server messages, in the user's terms. */
const MESSAGES: [RegExp, string][] = [
  [/cannot be booked yet/, "Ce prestataire est en cours de vérification : il ne peut pas encore être réservé."],
  [/cannot book themselves/, 'Vous ne pouvez pas vous réserver vous-même.'],
  [/long project needs/, 'Un projet long demande la signature du contrat de projet.'],
  [/already paid/, 'Cette demande est déjà payée.'],
  [/only a completed mission/, 'Seule une mission terminée peut être validée.'],
  [/only an accepted mission can be disputed/, 'Seule une mission acceptée peut faire l’objet d’un signalement.'],
  [/can no longer be accepted/, 'Cette demande ne peut plus être acceptée (délai dépassé ou déjà traitée).'],
  [/not approved yet/, "Votre profil n'est pas encore approuvé par 242Konnect."],
  [/can no longer be cancelled/, 'Cette demande ne peut plus être annulée.'],
  [/not signed in|JWT|jwt/, 'Votre session a expiré. Reconnectez-vous.'],
];

export class MarketplaceError extends Error {}

async function fail(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  const raw = payload.message ?? '';
  const known = MESSAGES.find(([re]) => re.test(raw));
  throw new MarketplaceError(known ? known[1] : "Le service 242Konnect n'a pas pu traiter la demande. Réessayez.");
}

async function call<T>(
  session: SupabaseSession,
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  if (!marketplaceEnabled) throw new MarketplaceError('Service indisponible sur cette version.');
  let response: Response;
  try {
    response = await supabaseFetch(path, init, session);
  } catch {
    throw new MarketplaceError('Connexion impossible. Vérifiez votre réseau et réessayez.');
  }
  if (!response.ok) return fail(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/* ------------------------------------------------------------------ */
/* Rows                                                               */
/* ------------------------------------------------------------------ */

type ListingRow = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  trade_id: string;
  zone: string;
  city: string;
  country: string;
  pricing: Pricing | null;
  durations: string[] | null;
  bio: string;
  status: ListingStatus;
  refusal_reason: string | null;
};

const listingFrom = (row: ListingRow): Listing => ({
  id: row.id,
  fullName: row.full_name,
  ...(row.avatar_url ? { avatar: row.avatar_url } : {}),
  tradeId: row.trade_id,
  zone: row.zone,
  city: row.city,
  country: row.country,
  ...(row.pricing ? { pricing: row.pricing } : {}),
  durations: row.durations ?? [],
  bio: row.bio,
  status: row.status,
  ...(row.refusal_reason ? { refusalReason: row.refusal_reason } : {}),
});

type RequestRow = {
  id: string;
  client_id: string;
  provider_id: string;
  client_name: string;
  trade_id: string;
  description: string;
  zone_hint: string;
  slot: string;
  duration: MissionDuration;
  contract_accepted_at: string | null;
  amount: number;
  currency: 'FCFA' | 'USD';
  idempotency_key: string;
  status: RequestStatus;
  stage: MissionStage | null;
  stage_at: Partial<Record<MissionStage, string>> | null;
  payment_method: string | null;
  payment_ref: string | null;
  paid_at: string | null;
  response_deadline: string | null;
  refund_status: 'none' | 'full' | 'under_review';
  dispute: { reason: string; outcome: string; details: string } | null;
  created_at: string;
};

const requestFrom = (row: RequestRow): RemoteRequest => ({
  id: row.id,
  clientId: row.client_id,
  providerId: row.provider_id,
  clientName: row.client_name,
  tradeId: row.trade_id,
  description: row.description,
  zoneHint: row.zone_hint,
  slot: row.slot,
  duration: row.duration,
  ...(row.contract_accepted_at ? { contractAcceptedAt: row.contract_accepted_at } : {}),
  amount: row.amount,
  currency: row.currency,
  idempotencyKey: row.idempotency_key,
  status: row.status,
  ...(row.stage ? { stage: row.stage } : {}),
  stageAt: row.stage_at ?? {},
  ...(row.payment_method ? { paymentMethod: row.payment_method } : {}),
  ...(row.payment_ref ? { paymentRef: row.payment_ref } : {}),
  ...(row.paid_at ? { paidAt: row.paid_at } : {}),
  ...(row.response_deadline ? { responseDeadline: row.response_deadline } : {}),
  refundStatus: row.refund_status,
  ...(row.dispute ? { dispute: row.dispute } : {}),
  createdAt: row.created_at,
});

/* ------------------------------------------------------------------ */
/* Directory                                                          */
/* ------------------------------------------------------------------ */

const LISTING_COLUMNS = 'id,full_name,trade_id,zone,city,country,pricing,durations,bio,status,refusal_reason';

/** Every listing, approved first. Pending ones are shown with their badge. */
export async function listListings(session: SupabaseSession): Promise<Listing[]> {
  const rows = await call<ListingRow[]>(
    session,
    `/rest/v1/provider_listings?select=${LISTING_COLUMNS}&order=status.asc,updated_at.desc&limit=200`
  );
  return rows.map(listingFrom);
}

export async function getListing(session: SupabaseSession, id: string): Promise<Listing | null> {
  const rows = await call<ListingRow[]>(
    session,
    `/rest/v1/provider_listings?id=eq.${encodeURIComponent(id)}&select=${LISTING_COLUMNS},avatar_url&limit=1`
  );
  return rows[0] ? listingFrom(rows[0]) : null;
}

/**
 * Publishes (or refreshes) the account's listing from its prestataire record.
 * `status` is never sent — the database does not let the app set it.
 */
export async function upsertListing(session: SupabaseSession, account: Account): Promise<void> {
  const p = account.prestataire;
  if (!p || !account.profiles.includes('prestataire')) return;
  await call<void>(session, '/rest/v1/provider_listings?on_conflict=id', {
    method: 'POST',
    body: {
      id: session.userId,
      full_name: account.name,
      avatar_url: account.avatar ?? null,
      trade_id: p.tradeId,
      zone: p.zone,
      city: account.location.city ?? '',
      country: account.location.country === 'US' ? 'US' : 'CG',
      pricing: p.pricing ?? (p.hourlyRate > 0 ? { model: 'hourly', amount: p.hourlyRate, negotiable: false, currency: 'FCFA' } : null),
      durations: p.durations ?? [],
      bio: account.bio ?? '',
    },
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  });
}

/* ------------------------------------------------------------------ */
/* Requests                                                           */
/* ------------------------------------------------------------------ */

export async function createRequest(
  session: SupabaseSession,
  input: {
    providerId: string;
    description: string;
    zoneHint: string;
    address: string;
    slot: string;
    duration: MissionDuration;
    contractSigned: boolean;
    amount: number;
    currency: 'FCFA' | 'USD';
  }
): Promise<RemoteRequest> {
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  const rows = await call<RequestRow[]>(session, '/rest/v1/service_requests', {
    method: 'POST',
    body: {
      provider_id: input.providerId,
      description: input.description,
      zone_hint: input.zoneHint,
      slot: input.slot,
      duration: input.duration,
      // The server stamps its own time; this only says the box was ticked.
      contract_accepted_at: input.contractSigned ? new Date().toISOString() : null,
      amount: Math.round(input.amount),
      currency: input.currency,
      idempotency_key: key,
    },
    headers: { Prefer: 'return=representation' },
  });
  const created = requestFrom(rows[0]);
  // Stored apart, so the prestataire cannot read it before accepting.
  await call<void>(session, '/rest/v1/service_request_private', {
    method: 'POST',
    body: { request_id: created.id, address: input.address },
    headers: { Prefer: 'return=minimal' },
  });
  return created;
}

/** Requests this account made, newest first. */
export async function listMyRequests(session: SupabaseSession): Promise<RemoteRequest[]> {
  const rows = await call<RequestRow[]>(
    session,
    `/rest/v1/service_requests?client_id=eq.${encodeURIComponent(session.userId)}&select=*&order=created_at.desc&limit=100`
  );
  return rows.map(requestFrom);
}

/** Requests sent to this account as a prestataire. Drafts never appear. */
export async function listIncoming(session: SupabaseSession): Promise<RemoteRequest[]> {
  const rows = await call<RequestRow[]>(
    session,
    `/rest/v1/service_requests?provider_id=eq.${encodeURIComponent(session.userId)}&select=*&order=created_at.desc&limit=100`
  );
  return rows.map(requestFrom);
}

/** The exact address — null for a prestataire until the request is accepted. */
export async function getAddress(session: SupabaseSession, requestId: string): Promise<string | null> {
  const rows = await call<{ address: string }[]>(
    session,
    `/rest/v1/service_request_private?request_id=eq.${encodeURIComponent(requestId)}&select=address&limit=1`
  );
  return rows[0]?.address ?? null;
}

export type RequestAction = 'pay' | 'cancel' | 'validate' | 'dispute' | 'accept' | 'decline' | 'advance';

export async function requestAction(
  session: SupabaseSession,
  requestId: string,
  action: RequestAction,
  payload: Record<string, unknown> = {}
): Promise<RemoteRequest> {
  const row = await call<RequestRow>(session, '/rest/v1/rpc/request_action', {
    method: 'POST',
    body: { p_request: requestId, p_action: action, p_payload: payload },
  });
  return requestFrom(row);
}

/* ------------------------------------------------------------------ */
/* Messages                                                           */
/* ------------------------------------------------------------------ */

export async function listMessages(session: SupabaseSession, requestId: string): Promise<RemoteMessage[]> {
  const rows = await call<{ id: number; sender_id: string; body: string; created_at: string }[]>(
    session,
    `/rest/v1/request_messages?request_id=eq.${encodeURIComponent(requestId)}&select=id,sender_id,body,created_at&order=created_at.asc&limit=500`
  );
  return rows.map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at }));
}

export async function sendMessage(session: SupabaseSession, requestId: string, body: string): Promise<void> {
  await call<void>(session, '/rest/v1/request_messages', {
    method: 'POST',
    body: { request_id: requestId, body },
    headers: { Prefer: 'return=minimal' },
  });
}
