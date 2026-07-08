import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getStripe, priceIdForTier } from "@/lib/stripe";

export const runtime = "nodejs";

/** Crée une session Stripe Checkout pour l'abonnement du cabinet connecté. */
const schema = z.object({ tier: z.enum(["ESSENTIAL", "PRO", "FIRM"]) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "client" || !session.organizationId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  const prisma = getPrisma();
  if (!stripe || !prisma) {
    return NextResponse.json(
      { ok: false, error: "billing_unavailable" },
      { status: 503 },
    );
  }

  let tier: z.infer<typeof schema>["tier"];
  try {
    const body: unknown = await request.json();
    tier = schema.parse(body).tier;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  const priceId = priceIdForTier(tier);
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "price_not_configured" },
      { status: 503 },
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
  });
  if (!org) {
    return NextResponse.json({ ok: false, error: "org_not_found" }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  try {
    // Réutilise le customer Stripe existant, sinon Stripe le crée au checkout
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(org.stripeCustomerId
        ? { customer: org.stripeCustomerId }
        : { customer_email: org.contactEmail }),
      client_reference_id: org.id,
      subscription_data: { metadata: { organizationId: org.id, tier } },
      success_url: `${siteUrl}/dashboard?billing=success`,
      cancel_url: `${siteUrl}/dashboard?billing=cancelled`,
    });
    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (err) {
    console.error("[billing/checkout] Erreur Stripe :", err);
    return NextResponse.json({ ok: false, error: "stripe_error" }, { status: 502 });
  }
}
