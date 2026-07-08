import Stripe from "stripe";
import type { SubscriptionTier } from "@prisma/client";

/**
 * Intégration Stripe (Phase 4) — Checkout + Customer Portal.
 * Les 3 paliers correspondent à des Price IDs configurés en variables
 * d'environnement. Sans STRIPE_SECRET_KEY, la facturation est désactivée
 * proprement (503 sur les routes billing).
 */

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeSingleton ??= new Stripe(key);
  return stripeSingleton;
}

export const TIER_PRICE_ENV: Record<SubscriptionTier, string> = {
  ESSENTIAL: "STRIPE_PRICE_ESSENTIAL",
  PRO: "STRIPE_PRICE_PRO",
  FIRM: "STRIPE_PRICE_FIRM",
};

export function priceIdForTier(tier: SubscriptionTier): string | null {
  return process.env[TIER_PRICE_ENV[tier]] ?? null;
}

export function tierForPriceId(priceId: string): SubscriptionTier | null {
  for (const tier of Object.keys(TIER_PRICE_ENV) as SubscriptionTier[]) {
    if (priceIdForTier(tier) === priceId) return tier;
  }
  return null;
}
