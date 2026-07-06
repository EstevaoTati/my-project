import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentEngineError, runAgentTurn } from "@/lib/agent/engine";

export const runtime = "nodejs";

const requestSchema = z.object({
  profession: z.enum(["tax", "immigration", "insurance"]),
  tone: z.enum(["professional", "formal", "concise"]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30), // borne la taille d'une session sandbox
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof requestSchema>;
  try {
    const body: unknown = await request.json();
    parsed = requestSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof z.ZodError ? err.flatten() : "invalid_json" },
      { status: 400 },
    );
  }

  try {
    const { result, mode } = await runAgentTurn(
      {
        profession: parsed.profession,
        tone: parsed.tone,
        firmName: "Cabinet Kabongo Tax Services",
      },
      parsed.messages,
    );
    return NextResponse.json({ ok: true, mode, result });
  } catch (err) {
    if (err instanceof AgentEngineError) {
      const status = err.code === "rate_limited" ? 429 : 502;
      return NextResponse.json({ ok: false, error: err.code }, { status });
    }
    console.error("[sandbox] Erreur inattendue :", err);
    return NextResponse.json({ ok: false, error: "unknown" }, { status: 500 });
  }
}

/** Le client interroge GET pour savoir si le mode live (clé API) est actif. */
export function GET() {
  return NextResponse.json({
    ok: true,
    mode: process.env.ANTHROPIC_API_KEY ? "live" : "mock",
  });
}
