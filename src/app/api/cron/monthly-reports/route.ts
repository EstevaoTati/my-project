import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getPrisma } from "@/lib/prisma";
import { generateMonthlyReport } from "@/lib/reports";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron des rapports mensuels — à déclencher le 1er du mois.
 * Vercel Cron (vercel.json) envoie `Authorization: Bearer $CRON_SECRET`.
 * Génère et envoie par email le rapport du mois écoulé pour chaque
 * organisation active.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 },
    );
  }

  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;

  const orgs = await prisma.organization.findMany({
    where: { active: true },
    select: { id: true, slug: true },
  });

  const results: Array<{ slug: string; ok: boolean }> = [];
  for (const org of orgs) {
    try {
      await generateMonthlyReport(prisma, org.id, year, month, {
        sendEmail: true,
      });
      results.push({ slug: org.slug, ok: true });
    } catch (err) {
      console.error(`[cron/reports] Échec pour ${org.slug} :`, err);
      results.push({ slug: org.slug, ok: false });
    }
  }

  return NextResponse.json({ ok: true, year, month, results });
}
