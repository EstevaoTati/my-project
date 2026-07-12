"use client";

import { useState } from "react";

/** Boutons Stripe : ouvre Checkout (nouvel abonnement) ou Customer Portal.
 *  Sans configuration Stripe côté serveur, l'API renvoie 503 et le bouton
 *  affiche un état désactivé propre. */
export default function BillingButtons({
  hasSubscription,
  labels,
}: {
  hasSubscription: boolean;
  labels: { manage: string; subscribe: string };
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function go(endpoint: string, body?: object) {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as { ok: boolean; url?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      {hasSubscription ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => go("/api/billing/portal")}
          className="btn-secondary !py-2 text-sm disabled:opacity-60"
        >
          {labels.manage}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(["ESSENTIAL", "PRO", "FIRM"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              disabled={loading}
              onClick={() => go("/api/billing/checkout", { tier })}
              className="btn-secondary !py-2 text-xs disabled:opacity-60"
            >
              {labels.subscribe} · {tier}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-amber-soft">
          Stripe non configuré sur ce déploiement.
        </p>
      )}
    </div>
  );
}
