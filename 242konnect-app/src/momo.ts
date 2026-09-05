/**
 * Mobile Money collections — MTN MoMo and Airtel Money.
 *
 * Both operators work the same way, and it is not a form submission. The
 * sequence is:
 *
 *   1. **Request to pay.** We send the amount and the payer's MSISDN to the
 *      operator's collection API.
 *   2. **The operator pushes a PIN prompt** to that handset over USSD. Nothing
 *      has moved yet, and our app has no part in this step — the customer types
 *      their Mobile Money PIN on their own phone.
 *   3. **We poll** the transaction until it leaves PENDING for SUCCESSFUL or
 *      FAILED, or until the prompt expires unanswered.
 *
 * That third step is why the old one-tap "payer" button could never have been
 * real: a mobile money payment is asynchronous by construction, and the UI has
 * to hold a pending state for a minute or so while the customer finds their
 * phone.
 *
 * **Credentials stay server-side.** MTN Collections wants a subscription key,
 * an API user and an API key; Airtel wants a client id and secret. Any of those
 * in the bundle can be pulled out of the APK and used to collect money into our
 * merchant account — so the app talks to `242konnect-api/`, which holds them and
 * talks to the operators. Same reasoning as the Resend key in `otpClient.ts`.
 */

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** True when a real collection gateway is reachable. */
export const momoGatewayConfigured = API_URL.length > 0;

export type MomoOperator = 'mtn' | 'airtel';

export const OPERATOR_LABELS: Record<MomoOperator, string> = {
  mtn: 'MTN Mobile Money',
  airtel: 'Airtel Money',
};

/**
 * Mobile prefixes in the Republic of the Congo (+242), on the national nine
 * digit format — "06 123 45 67" is MTN.
 *
 * Used to *suggest* an operator and to warn on an obvious mismatch, never to
 * refuse a payment: number portability and prefix reallocations both make a
 * hard block the wrong call. A customer who knows their own line beats our
 * table.
 */
export const OPERATOR_PREFIXES: Record<MomoOperator, string[]> = {
  mtn: ['06'],
  airtel: ['04', '05'],
};

/** The operator a number looks like it belongs to, or null if unrecognised. */
export function operatorForPhone(phone: string): MomoOperator | null {
  const digits = phone.replace(/\D/g, '');
  for (const [operator, prefixes] of Object.entries(OPERATOR_PREFIXES) as [MomoOperator, string[]][]) {
    if (prefixes.some((p) => digits.startsWith(p))) return operator;
  }
  return null;
}

/**
 * How long the operator leaves the PIN prompt on screen before giving up. Both
 * MTN and Airtel expire an unanswered request; a minute is the conservative
 * figure, and the UI counts down against it so the wait has an end.
 */
export const PIN_PROMPT_TIMEOUT_SECONDS = 90;

/** How often to ask the gateway whether the customer has finished. */
export const POLL_INTERVAL_MS = 3000;

export type CollectionStatus = 'pending' | 'successful' | 'failed' | 'expired';

export type Collection = {
  /** Our reference for the transaction, used to poll and to show on the receipt. */
  id: string;
  status: CollectionStatus;
  /** The operator's own reference, once it has one. */
  operatorReference?: string;
  /** Why it failed, in French, when it did. */
  reason?: string;
  /** True when no gateway is configured and this ran as a walkthrough. */
  simulated: boolean;
};

export class MomoError extends Error {}

const TIMEOUT_MS = 20000;

async function call(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const detail = typeof payload.detail === 'string' ? payload.detail : null;
      throw new MomoError(detail ?? "Le paiement Mobile Money n'a pas pu être lancé.");
    }
    return payload;
  } catch (e) {
    if (e instanceof MomoError) throw e;
    if (e instanceof Error && e.name === 'AbortError')
      throw new MomoError('Le service de paiement ne répond pas. Vérifiez votre connexion.');
    throw new MomoError('Impossible de joindre le service de paiement.');
  } finally {
    clearTimeout(timer);
  }
}

function parse(payload: Record<string, unknown>, simulated = false): Collection {
  const status = String(payload.status ?? 'pending');
  return {
    id: String(payload.id ?? ''),
    status: (['pending', 'successful', 'failed', 'expired'].includes(status)
      ? status
      : 'pending') as CollectionStatus,
    operatorReference:
      typeof payload.operator_reference === 'string' ? payload.operator_reference : undefined,
    reason: typeof payload.reason === 'string' ? payload.reason : undefined,
    simulated,
  };
}

/* ------------------------------------------------------------------ *
 * Simulation, for builds with no gateway configured
 * ------------------------------------------------------------------ */

/**
 * A walkthrough of the same state machine, so a tester on a preview link sees
 * exactly the sequence a real payer sees — prompt, wait, result — rather than a
 * button that instantly claims success.
 *
 * Every screen that can reach this path labels the result as a simulation. That
 * is honest in a way that showing a verification code on screen was not: no
 * money moves in either case, whereas a printed OTP defeated the control it
 * claimed to implement.
 */
const simulated = new Map<string, number>();

/** Numbers ending in 0 fail, so the failure path can be demonstrated too. */
function simulatedOutcome(phone: string): CollectionStatus {
  return phone.replace(/\D/g, '').endsWith('0') ? 'failed' : 'successful';
}

/**
 * Starts a collection: asks the operator to prompt `phone` for its PIN.
 *
 * Resolves as soon as the prompt is *sent*, with status `pending`. It does not
 * wait for the customer — that is what `pollCollection` is for.
 */
export async function requestToPay(input: {
  operator: MomoOperator;
  phone: string;
  amount: number;
  /** Shown to the payer in the operator's prompt, where supported. */
  label: string;
}): Promise<Collection> {
  const phone = input.phone.replace(/\D/g, '');

  if (!momoGatewayConfigured) {
    const id = `SIM-${Date.now().toString(36).toUpperCase()}`;
    simulated.set(id, Date.now());
    return { id, status: 'pending', simulated: true };
  }

  const payload = await call('/payments/momo/request-to-pay', {
    method: 'POST',
    body: JSON.stringify({
      operator: input.operator,
      phone,
      amount: Math.round(input.amount),
      currency: 'XAF',
      label: input.label,
    }),
  });
  return parse(payload);
}

/** Asks where a collection has got to. */
export async function collectionStatus(id: string, phone: string): Promise<Collection> {
  if (!momoGatewayConfigured) {
    const startedAt = simulated.get(id);
    if (startedAt === undefined) return { id, status: 'failed', reason: 'Transaction inconnue.', simulated: true };
    // Four seconds stands in for the customer reaching for their phone.
    if (Date.now() - startedAt < 4000) return { id, status: 'pending', simulated: true };
    simulated.delete(id);
    const outcome = simulatedOutcome(phone);
    return {
      id,
      status: outcome,
      operatorReference: outcome === 'successful' ? `SIM${id.slice(-6)}` : undefined,
      reason: outcome === 'failed' ? 'Solde insuffisant sur le compte Mobile Money.' : undefined,
      simulated: true,
    };
  }

  const payload = await call(`/payments/momo/${encodeURIComponent(id)}`, { method: 'GET' });
  return parse(payload);
}

/**
 * Polls until the collection settles, the prompt expires, or `signal` aborts.
 *
 * `onTick` reports the seconds remaining so the sheet can count down. Polling
 * errors are swallowed rather than thrown: one failed request in the middle of a
 * payment that is still running should not tell the user it failed.
 */
export async function pollCollection(
  id: string,
  phone: string,
  options: {
    onTick?: (secondsLeft: number) => void;
    signal?: AbortSignal;
  } = {}
): Promise<Collection> {
  const deadline = Date.now() + PIN_PROMPT_TIMEOUT_SECONDS * 1000;

  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw new MomoError('Paiement annulé.');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    if (options.signal?.aborted) throw new MomoError('Paiement annulé.');

    options.onTick?.(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

    try {
      const current = await collectionStatus(id, phone);
      if (current.status !== 'pending') return current;
    } catch {
      // Transient: keep waiting until the deadline rather than failing the
      // payment on one bad response.
    }
  }

  return {
    id,
    status: 'expired',
    reason: "Aucune confirmation reçue. La demande a expiré sur votre téléphone.",
    simulated: !momoGatewayConfigured,
  };
}

/** The message to show for a settled-but-unsuccessful collection. */
export function failureMessage(collection: Collection): string {
  if (collection.reason) return collection.reason;
  if (collection.status === 'expired')
    return "La demande a expiré avant que vous ne saisissiez votre code PIN.";
  return "Le paiement a été refusé par l'opérateur.";
}
