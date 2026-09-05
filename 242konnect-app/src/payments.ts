/**
 * The money rules, from chapters 5 and 6 of the cahier des charges.
 *
 * Kept in one file, away from the screens, because these are business rules
 * rather than presentation: a change to the commission has to be made once, and
 * the arithmetic has to be inspectable without reading a component.
 *
 * The flow the spec describes (§5.8) is escrow, not a direct payment:
 *
 *   client pays 242Konnect  →  prestataire confirms and travels  →  service
 *   →  client validates  →  commission deducted  →  prestataire paid
 *
 * Two rules are absolute in the spec and are surfaced in the UI:
 *   - the client never pays the prestataire directly, not even a tip (§2.2);
 *   - the prestataire's money is released only after the client validates
 *     (§5.8, §6.4) — or after 242Konnect settles a dispute.
 */

/** 242Konnect's commission on every completed prestation (§6.5). */
export const COMMISSION_RATE = 0.12;

/** Payout options for the prestataire (§6.6). */
export const PAYOUT_STANDARD_RATE = 0.0125;
export const PAYOUT_STANDARD_DELAY_DAYS = 7;
export const PAYOUT_EXPRESS_RATE = 0.04;

export type PayoutSpeed = 'standard' | 'express';

export type Settlement = {
  /** What the client pays into 242Konnect. */
  total: number;
  /** 242Konnect's 12 % commission. */
  commission: number;
  /** Processing fee on the payout, depending on the speed chosen. */
  payoutFee: number;
  /** What actually reaches the prestataire. */
  net: number;
  speed: PayoutSpeed;
  /** Days until the payout lands; 0 for express. */
  delayDays: number;
};

/**
 * Splits a service price into what the client pays, what 242Konnect keeps and
 * what the prestataire receives.
 *
 * The payout fee applies to the amount left after commission, not to the gross:
 * it is a fee on the transfer being made, and the commission never reaches the
 * prestataire's balance to be transferred.
 */
export function settle(total: number, speed: PayoutSpeed): Settlement {
  const commission = total * COMMISSION_RATE;
  const afterCommission = total - commission;
  const payoutFee = afterCommission * (speed === 'express' ? PAYOUT_EXPRESS_RATE : PAYOUT_STANDARD_RATE);
  return {
    total,
    commission,
    payoutFee,
    net: afterCommission - payoutFee,
    speed,
    delayDays: speed === 'express' ? 0 : PAYOUT_STANDARD_DELAY_DAYS,
  };
}

/**
 * Payment methods (§6.3, §9.6). Cash is deliberately absent: the spec is
 * explicit that every payment goes through the platform and that the client
 * must not hand the prestataire even 1 FCFA directly.
 */
export type PaymentMethod = 'mtn' | 'airtel' | 'carte' | 'virement';

export const PAYMENT_METHODS: {
  id: PaymentMethod;
  label: string;
  hint: string;
  /** Whether the method needs a phone number to debit. */
  needsPhone: boolean;
}[] = [
  {
    id: 'mtn',
    label: 'MTN Mobile Money',
    hint: 'Confirmation par code PIN sur votre téléphone',
    needsPhone: true,
  },
  {
    id: 'airtel',
    label: 'Airtel Money',
    hint: 'Confirmation par code PIN sur votre téléphone',
    needsPhone: true,
  },
  { id: 'carte', label: 'Carte bancaire', hint: 'Visa, Mastercard', needsPhone: false },
  { id: 'virement', label: 'Virement bancaire', hint: 'Depuis votre banque', needsPhone: false },
];

export function paymentMethodLabel(id: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}

export function methodNeedsPhone(id: PaymentMethod | null): boolean {
  return !!id && !!PAYMENT_METHODS.find((m) => m.id === id)?.needsPhone;
}
