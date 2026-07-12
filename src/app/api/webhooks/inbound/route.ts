import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { AgentEngineError } from "@/lib/agent/engine";
import { AgentServiceError, processInboundMessage } from "@/lib/agent/service";

export const runtime = "nodejs";

/**
 * Webhook d'entrée du moteur d'agent (Phase 2).
 * Reçoit une demande entrante (email relayé, formulaire web du cabinet…),
 * la traite via l'AgentEngine et journalise tout.
 *
 * Sécurité : header `x-mwinda-webhook-secret` comparé (temps constant) à
 * WEBHOOK_SECRET. Sans WEBHOOK_SECRET configurée, l'endpoint est désactivé.
 */

const inboundSchema = z.object({
  organizationSlug: z.string().min(1).max(100),
  prospectEmail: z.string().email().max(320),
  prospectName: z.string().max(200).nullish(),
  content: z.string().min(1).max(8000),
  channel: z.enum(["EMAIL", "WEB_FORM"]).default("EMAIL"),
  conversationId: z.string().max(50).nullish(),
});

function isAuthorized(request: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-mwinda-webhook-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "webhook_disabled", detail: "WEBHOOK_SECRET non configurée." },
      { status: 503 },
    );
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json(
      { ok: false, error: "database_unavailable", detail: "DATABASE_URL non configurée." },
      { status: 503 },
    );
  }

  let parsed: z.infer<typeof inboundSchema>;
  try {
    const body: unknown = await request.json();
    parsed = inboundSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof z.ZodError ? err.flatten() : "invalid_json" },
      { status: 400 },
    );
  }

  try {
    const outcome = await processInboundMessage(prisma, {
      organizationSlug: parsed.organizationSlug,
      prospectEmail: parsed.prospectEmail,
      prospectName: parsed.prospectName ?? null,
      content: parsed.content,
      channel: parsed.channel,
      conversationId: parsed.conversationId ?? null,
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    if (err instanceof AgentServiceError) {
      const status = err.code === "org_not_found" ? 404 : 422;
      return NextResponse.json({ ok: false, error: err.code }, { status });
    }
    if (err instanceof AgentEngineError) {
      const status = err.code === "rate_limited" ? 429 : 502;
      return NextResponse.json({ ok: false, error: err.code }, { status });
    }
    console.error("[webhook/inbound] Erreur inattendue :", err);
    return NextResponse.json({ ok: false, error: "unknown" }, { status: 500 });
  }
}
