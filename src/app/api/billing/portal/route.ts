import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** Ouvre le Stripe Customer Portal pour le cabinet connecté. */
export async function POST() {
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

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) {
    return NextResponse.json({ ok: false, error: "no_subscription" }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${siteUrl}/dashboard`,
    });
    return NextResponse.json({ ok: true, url: portal.url });
  } catch (err) {
    console.error("[billing/portal] Erreur Stripe :", err);
    return NextResponse.json({ ok: false, error: "stripe_error" }, { status: 502 });
  }
}
