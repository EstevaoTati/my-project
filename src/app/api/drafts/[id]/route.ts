import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * File de validation du mode brouillon (Phase 2).
 * PATCH /api/drafts/:id — approuver (avec modification éventuelle) ou rejeter
 * une réponse d'agent en attente. Sera consommée par le dashboard client
 * (Phase 3) ; protégée en attendant par le même secret que le webhook.
 */

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  /** Contenu corrigé par l'humain avant approbation (optionnel) */
  editedContent: z.string().min(1).max(8000).optional(),
});

function isAuthorized(request: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-mwinda-webhook-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.WEBHOOK_SECRET || !isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 },
    );
  }

  const { id } = await params;

  let parsed: z.infer<typeof actionSchema>;
  try {
    const body: unknown = await request.json();
    parsed = actionSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof z.ZodError ? err.flatten() : "invalid_json" },
      { status: 400 },
    );
  }

  const draft = await prisma.message.findUnique({ where: { id } });
  if (!draft || draft.status !== "DRAFT" || draft.role !== "AGENT") {
    return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });
  }

  const updated = await prisma.message.update({
    where: { id },
    data:
      parsed.action === "approve"
        ? {
            status: "APPROVED",
            ...(parsed.editedContent ? { content: parsed.editedContent } : {}),
          }
        : { status: "REJECTED" },
  });

  // NB : l'envoi effectif (email sortant) sera branché avec le canal email ;
  // APPROVED est l'état « prêt à partir » consommé par l'expéditeur.
  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
