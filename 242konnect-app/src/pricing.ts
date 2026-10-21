/**
 * How a prestataire prices a service — Parcours Prestataire §03.
 *
 * The spec's rules, each of which the old single "tarif horaire" field broke:
 *
 * - Four models: fixed, "from", hourly, or quote required. A plumber quoting a
 *   bathroom and a cleaner charging by the hour are not the same offer.
 * - **Never impose an hourly default.** There is no preselected model: the
 *   prestataire picks one, or the form does not continue.
 * - A "negotiable" option, shown plainly to the client.
 * - The durations the prestataire accepts, from a few hours to more than six
 *   months (§03, §11).
 * - The currency follows the verified country: USD in the United States, FCFA
 *   in Congo. It is derived, never typed, so the two cannot disagree.
 */

import type { CountryCode } from './countries';
import { T } from './i18n';

export type PricingModel = 'fixed' | 'from' | 'hourly' | 'quote';
export type Currency = 'FCFA' | 'USD';

export type Pricing = {
  model: PricingModel;
  /** Absent for `quote`. Whole units of `currency`. */
  amount?: number;
  negotiable: boolean;
  currency: Currency;
};

export type ProjectDuration = 'hours' | 'days' | 'weeks' | 'months' | 'long';

export const PRICING_MODELS: { id: PricingModel; label: string; hint: string }[] = [
  { id: 'fixed', label: T('Prix fixe'), hint: T('Un montant pour le service') },
  { id: 'from', label: T('À partir de'), hint: T('Un prix de départ, ajusté selon le besoin') },
  { id: 'hourly', label: T('Tarif horaire'), hint: T("Facturé à l'heure") },
  { id: 'quote', label: T('Sur devis'), hint: T('Le prix est fixé après étude de la demande') },
];

export const DURATIONS: { id: ProjectDuration; label: string }[] = [
  { id: 'hours', label: T('Quelques heures') },
  { id: 'days', label: T('Quelques jours') },
  { id: 'weeks', label: T('Quelques semaines') },
  { id: 'months', label: T('1 à 6 mois') },
  { id: 'long', label: T('Plus de 6 mois') },
];

/** Congo → FCFA, United States → USD. */
export function currencyFor(country: CountryCode | string | undefined): Currency {
  return country === 'US' ? 'USD' : 'FCFA';
}

export function formatAmount(amount: number, currency: Currency): string {
  return currency === 'USD'
    ? `${amount.toLocaleString('en-US')} USD`
    : `${Math.round(amount).toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`;
}

/**
 * The price as a client reads it, untranslated parts filled in by `t`.
 * "À partir de 15 000 FCFA", "25 USD/h", "Sur devis".
 */
export function describePricing(p: Pricing | undefined, t: (s: string) => string): string {
  if (!p) return '—';
  if (p.model === 'quote') return t('Sur devis');
  const amount = formatAmount(p.amount ?? 0, p.currency);
  if (p.model === 'hourly') return `${amount}/h`;
  if (p.model === 'from') return `${t('À partir de')} ${amount}`;
  return amount;
}

/** Why a pricing cannot be saved, or null when it can. */
export function pricingProblem(p: Partial<Pricing> | undefined): string | null {
  if (!p?.model) return T('Choisissez un modèle de prix.');
  if (p.model !== 'quote' && !(Number(p.amount) > 0)) return T('Indiquez un montant.');
  return null;
}

/**
 * Accounts created before §03 have only `hourlyRate`. They were genuinely
 * hourly — that was the only thing the form could say — so that is what they
 * are read as, in FCFA, rather than being asked to start again.
 */
export function pricingOf(
  details: { pricing?: Pricing; hourlyRate?: number } | undefined,
  country?: CountryCode | string
): Pricing | undefined {
  if (details?.pricing) return details.pricing;
  if (details?.hourlyRate && details.hourlyRate > 0)
    return { model: 'hourly', amount: details.hourlyRate, negotiable: false, currency: currencyFor(country) };
  return undefined;
}

/**
 * The number the booking flow charges. Only meaningful for priced models; a
 * quote has no amount until the prestataire sends one.
 */
export function bookableAmount(p: Pricing | undefined): number {
  return p && p.model !== 'quote' ? p.amount ?? 0 : 0;
}
