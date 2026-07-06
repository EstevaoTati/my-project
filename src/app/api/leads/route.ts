import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { sendLeadNotification } from "@/lib/email";

export const runtime = "nodejs";

const leadSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  phone: z.string().max(40).nullish(),
  firmName: z.string().min(1).max(200),
  profession: z.enum([
    "TAX_PREPARER",
    "IMMIGRATION_LAWYER",
    "INSURANCE_AGENT",
    "ACCOUNTANT",
    "TRAVEL_AGENCY",
    "OTHER",
  ]),
  weeklyInquiries: z.enum(["UNDER_10", "FROM_10_TO_30", "FROM_30_TO_75", "OVER_75"]),
  averageTicket: z.number().int().min(0).max(1_000_000).nullish(),
  preferredLanguage: z.enum(["FR", "EN", "BOTH"]),
  message: z.string().max(5000).nullish(),
  locale: z.string().max(5).default("fr"),
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof leadSchema>;
  try {
    const body: unknown = await request.json();
    parsed = leadSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof z.ZodError ? err.flatten() : "invalid_json" },
      { status: 400 },
    );
  }

  // 1. Enregistrement en base (si DATABASE_URL est configurée)
  const prisma = getPrisma();
  let persisted = false;
  if (prisma) {
    try {
      await prisma.lead.create({
        data: {
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone ?? null,
          firmName: parsed.firmName,
          profession: parsed.profession,
          weeklyInquiries: parsed.weeklyInquiries,
          averageTicket: parsed.averageTicket ?? null,
          preferredLanguage: parsed.preferredLanguage,
          message: parsed.message ?? null,
          locale: parsed.locale,
        },
      });
      persisted = true;
    } catch (err) {
      console.error("[leads] Échec d'écriture en base :", err);
      // On continue : la notification email sert de filet de sécurité.
    }
  } else {
    console.warn("[leads] DATABASE_URL absente — lead non persisté :", parsed.email);
  }

  // 2. Notification email (ne bloque jamais la réponse au visiteur)
  await sendLeadNotification({
    name: parsed.name,
    email: parsed.email,
    phone: parsed.phone ?? null,
    firmName: parsed.firmName,
    profession: parsed.profession,
    weeklyInquiries: parsed.weeklyInquiries,
    averageTicket: parsed.averageTicket ?? null,
    preferredLanguage: parsed.preferredLanguage,
    message: parsed.message ?? null,
    locale: parsed.locale,
  });

  return NextResponse.json({ ok: true, persisted });
}
