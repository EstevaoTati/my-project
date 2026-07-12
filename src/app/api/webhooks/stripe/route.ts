import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getPrisma } from "@/lib/prisma";
import { getStripe, tierForPriceId } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Webhook Stripe : synchronise l'état d'abonnement des organisations.
 * Signature vérifiée avec STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const prisma = getPrisma();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !prisma || !secret) {
    return NextResponse.json({ ok: false, error: "unconfigured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[webhooks/stripe] Signature invalide :", err);
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const checkout = event.data.object;
        const organizationId = checkout.client_reference_id;
        const customerId =
          typeof checkout.customer === "string"
            ? checkout.customer
            : checkout.customer?.id;
        if (organizationId && customerId) {
          await prisma.organization.update({
            where: { id: organizationId },
            data: { stripeCustomerId: customerId },
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer.id;
        const priceId = subscription.items.data[0]?.price.id;
        const tier = priceId ? tierForPriceId(priceId) : null;
        await prisma.organization.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: subscription.status,
            subscriptionTier:
              event.type === "customer.subscription.deleted" ? null : tier,
          },
        });
        break;
      }
      default:
        break; // événements non suivis : ack silencieux
    }
  } catch (err) {
    console.error("[webhooks/stripe] Erreur de traitement :", err);
    return NextResponse.json({ ok: false, error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
