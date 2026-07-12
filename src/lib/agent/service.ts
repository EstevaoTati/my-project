import type {
  AgentConfig as DbAgentConfig,
  Channel,
  Conversation,
  Message,
  Organization,
  PrismaClient,
} from "@prisma/client";
import { isLiveMode, runAgentTurn } from "./engine";
import type {
  AgentProfession,
  AgentTone,
  AgentTurnResult,
  ChatMessage,
} from "./types";

/**
 * Service AgentEngine (Phase 2) — orchestration production :
 * reçoit un message entrant, charge la config du cabinet, appelle le moteur,
 * journalise TOUT, et respecte le mode « brouillon d'abord ».
 */

const PROFESSION_MAP: Record<DbAgentConfig["profession"], AgentProfession> = {
  TAX: "tax",
  IMMIGRATION: "immigration",
  INSURANCE: "insurance",
};

const TONE_MAP: Record<DbAgentConfig["tone"], AgentTone> = {
  PROFESSIONAL: "professional",
  FORMAL: "formal",
  CONCISE: "concise",
};

export interface InboundMessage {
  organizationSlug: string;
  prospectEmail: string;
  prospectName?: string | null;
  content: string;
  channel: Channel;
  /** Continuer une conversation précise (sinon : reprise par email ou création) */
  conversationId?: string | null;
}

export interface InboundResult {
  conversationId: string;
  /** DRAFT : en attente de validation humaine (mode brouillon) ; SENT : envoyée */
  replyStatus: "DRAFT" | "SENT";
  draftMode: boolean;
  engineMode: "live" | "mock";
  result: AgentTurnResult;
}

export class AgentServiceError extends Error {
  constructor(
    public readonly code:
      | "org_not_found"
      | "org_inactive"
      | "config_missing",
    message: string,
  ) {
    super(message);
    this.name = "AgentServiceError";
  }
}

type ConversationWithMessages = Conversation & { messages: Message[] };

/** Reconstruit l'historique moteur depuis le journal (brouillons/rejets exclus). */
function toChatHistory(messages: Message[]): ChatMessage[] {
  return messages
    .filter(
      (m) =>
        m.role === "PROSPECT" ||
        ((m.role === "AGENT" || m.role === "HUMAN") &&
          (m.status === "SENT" || m.status === "APPROVED")),
    )
    .map((m) => ({
      role: m.role === "PROSPECT" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
}

async function findOrCreateConversation(
  prisma: PrismaClient,
  org: Organization,
  inbound: InboundMessage,
): Promise<ConversationWithMessages> {
  if (inbound.conversationId) {
    const existing = await prisma.conversation.findFirst({
      where: { id: inbound.conversationId, organizationId: org.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (existing) return existing;
  }

  const byEmail = await prisma.conversation.findFirst({
    where: {
      organizationId: org.id,
      prospectEmail: inbound.prospectEmail,
      status: { in: ["OPEN", "APPOINTMENT_PROPOSED"] },
    },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (byEmail) return byEmail;

  const created = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      channel: inbound.channel,
      prospectEmail: inbound.prospectEmail,
      prospectName: inbound.prospectName ?? null,
    },
    include: { messages: true },
  });
  return created;
}

/**
 * Traite un message entrant de bout en bout.
 * Toutes les écritures de journalisation sont faites même si l'appel modèle
 * échoue APRÈS l'enregistrement du message prospect (aucune perte d'entrant).
 */
export async function processInboundMessage(
  prisma: PrismaClient,
  inbound: InboundMessage,
): Promise<InboundResult> {
  const org = await prisma.organization.findUnique({
    where: { slug: inbound.organizationSlug },
    include: { agentConfig: true },
  });
  if (!org) {
    throw new AgentServiceError("org_not_found", "Organisation inconnue.");
  }
  if (!org.active) {
    throw new AgentServiceError("org_inactive", "Organisation désactivée.");
  }
  if (!org.agentConfig) {
    throw new AgentServiceError("config_missing", "AgentConfig manquante.");
  }

  const conversation = await findOrCreateConversation(prisma, org, inbound);

  // 1. Journaliser le message prospect AVANT tout appel modèle
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "PROSPECT",
      content: inbound.content,
      status: "SENT",
    },
  });

  // 2. Appeler le moteur avec l'historique complet
  const history: ChatMessage[] = [
    ...toChatHistory(conversation.messages),
    { role: "user", content: inbound.content },
  ];

  const { result, mode } = await runAgentTurn(
    {
      profession: PROFESSION_MAP[org.agentConfig.profession],
      tone: TONE_MAP[org.agentConfig.tone],
      firmName: org.name,
      customRules: org.agentConfig.customRules ?? undefined,
    },
    history,
  );

  // 3. Journaliser la réponse de l'agent (brouillon si draftMode)
  const replyStatus: "DRAFT" | "SENT" = org.draftMode ? "DRAFT" : "SENT";
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "AGENT",
      content: result.reply,
      status: replyStatus,
      modelUsed: mode === "live" ? "claude-sonnet-4-6" : "mock",
      qualificationScore: result.qualificationScore,
    },
  });

  // 4. Mettre à jour l'état de la conversation
  const nextStatus =
    result.recommendedAction === "ESCALATE"
      ? "ESCALATED"
      : result.recommendedAction === "PROPOSE_APPOINTMENT"
        ? "APPOINTMENT_PROPOSED"
        : conversation.status;

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      detectedLanguage: result.detectedLanguage,
      qualificationScore: result.qualificationScore,
      recommendedAction: result.recommendedAction,
      summaryForHuman: result.summaryForHuman,
      status: nextStatus,
      prospectName: inbound.prospectName ?? conversation.prospectName,
    },
  });

  // 5. Créer le rendez-vous proposé s'il n'existe pas encore
  if (result.recommendedAction === "PROPOSE_APPOINTMENT") {
    await prisma.appointment.upsert({
      where: { conversationId: conversation.id },
      create: { conversationId: conversation.id, proposedSlots: null },
      update: {},
    });
  }

  return {
    conversationId: conversation.id,
    replyStatus,
    draftMode: org.draftMode,
    engineMode: isLiveMode() ? "live" : "mock",
    result,
  };
}
