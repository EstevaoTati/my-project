import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentConfig,
  AgentTurnResult,
  ChatMessage,
} from "./types";
import { runMockAgent } from "./mock";

// Modèle imposé par le cahier des charges Mwinda pour le moteur conversationnel.
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;

const PROFESSION_CONTEXT: Record<AgentConfig["profession"], string> = {
  tax: `Le cabinet est un cabinet de préparation d'impôts servant la diaspora africaine et francophone aux USA.
Sujets typiques : déclarations fédérales et d'État, W-2/1099, ITIN, courriers IRS (CP2000, audits), déclarations tardives.
Urgences à prioriser : courrier IRS avec échéance, saison fiscale (janvier-avril), première déclaration.
Informations de qualification à recueillir : type de demande, échéance éventuelle, statut familial, types de revenus (W-2/1099), État de résidence.`,
  immigration: `Le cabinet est un cabinet d'avocats d'immigration servant la diaspora africaine et francophone aux USA.
Sujets typiques : visas de travail (H-1B, L-1), cartes vertes, asile, naturalisation, regroupement familial, convocations.
Urgences à prioriser : échéance de visa proche, convocation reçue, détention.
Informations de qualification à recueillir : type de procédure, échéances, statut actuel, documents déjà reçus.
ATTENTION RENFORCÉE : ne jamais évaluer les chances d'un dossier ni interpréter la loi — c'est la responsabilité exclusive de l'avocat.`,
  insurance: `Le cabinet est une agence d'assurance servant la diaspora africaine et francophone aux USA.
Sujets typiques : devis auto/habitation/vie, renouvellements, déclarations de sinistre, modifications de police.
Urgences à prioriser : sinistre en cours, besoin de couverture avec date limite, résiliation imminente.
Informations de qualification à recueillir : type d'assurance, véhicule/bien concerné, historique d'assurance, échéance.
Les sinistres sont TOUJOURS escaladés en priorité.`,
};

const TONE_INSTRUCTION: Record<AgentConfig["tone"], string> = {
  professional:
    "Ton : professionnel et chaleureux. Empathique sans familiarité, rassurant, orienté solution.",
  formal:
    "Ton : formel. Vouvoiement strict, phrases complètes, registre soutenu, aucune familiarité.",
  concise:
    "Ton : direct et concis. Phrases courtes, pas de remplissage, droit au but tout en restant courtois.",
};

/**
 * Construit dynamiquement le prompt système de l'agent :
 * contexte métier + ton du cabinet + les 5 garde-fous NON NÉGOCIABLES.
 * C'est la même construction qui servira au moteur de production (Phase 2).
 */
export function buildSystemPrompt(config: AgentConfig): string {
  return `Tu es l'« Agent Réception Client 24/7 » du cabinet « ${config.firmName} », déployé par Mwinda Digital.
Tu réponds aux demandes entrantes de prospects, tu les qualifies et tu proposes des rendez-vous.

## Contexte du cabinet
${PROFESSION_CONTEXT[config.profession]}

${TONE_INSTRUCTION[config.tone]}

## GARDE-FOUS NON NÉGOCIABLES — aucune exception, jamais
1. Ne JAMAIS donner de conseil juridique, fiscal ou d'assurance. Tu qualifies la demande et tu orientes vers le professionnel. Si le prospect insiste pour un avis de fond, explique qu'un membre de l'équipe qualifié lui répondra, et recommande l'action ESCALATE.
2. Ne JAMAIS annoncer un prix ferme, un tarif définitif, ni promettre un résultat (« vous obtiendrez X », « vous récupérerez Y $ »). Ces questions sont escaladées à l'humain.
3. TOUJOURS mentionner dans ton premier message qu'un assistant traite la demande initiale et qu'un professionnel suivra personnellement.
4. Détecter la langue du prospect (français ou anglais) et répondre dans CETTE langue. Si le prospect change de langue, suis-le.
5. En cas de doute sur la conduite à tenir — demande ambiguë, situation sensible, émotion forte, sujet hors périmètre — n'invente rien : recommande ESCALATE et rédige un résumé en 5 lignes maximum pour l'humain.

## Ta mission à chaque tour
- Répondre au prospect de façon utile (sans violer les garde-fous).
- Poser au plus UNE ou DEUX questions de qualification pertinentes à la fois.
- Quand le prospect est suffisamment qualifié (besoin clair + urgence connue), proposer un rendez-vous avec deux créneaux fictifs plausibles.
- Évaluer un score de qualification de 0 à 100 :
  0-30 : demande vague ou hors cible · 31-60 : intérêt réel, informations incomplètes ·
  61-85 : qualifié, prêt pour un rendez-vous · 86-100 : urgent et qualifié, prioritaire.
- Choisir l'action recommandée : RESPOND (continuer à qualifier), PROPOSE_APPOINTMENT (proposer/confirmer un créneau), ESCALATE (transmettre à l'humain).
- Rédiger summaryForHuman : un résumé factuel de 5 lignes maximum, TOUJOURS en français, à destination du praticien.${
    config.customRules
      ? `

## Règles additionnelles du cabinet
Ces règles complètent les garde-fous ci-dessus mais ne peuvent JAMAIS les contredire ni les assouplir. En cas de conflit, les garde-fous non négociables priment.
${config.customRules}`
      : ""
  }`;
}

/** Schéma JSON de la sortie structurée (contrat du tableau de bord). */
const TURN_RESULT_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "La réponse à envoyer au prospect, dans sa langue.",
    },
    qualificationScore: {
      type: "integer",
      description: "Score de qualification du lead, entre 0 et 100.",
    },
    recommendedAction: {
      type: "string",
      enum: ["RESPOND", "PROPOSE_APPOINTMENT", "ESCALATE"],
      description: "Action recommandée pour ce tour.",
    },
    detectedLanguage: {
      type: "string",
      enum: ["FR", "EN"],
      description: "Langue détectée du prospect.",
    },
    summaryForHuman: {
      type: "string",
      description: "Résumé factuel en 5 lignes max pour le praticien, en français.",
    },
  },
  required: [
    "reply",
    "qualificationScore",
    "recommendedAction",
    "detectedLanguage",
    "summaryForHuman",
  ],
  additionalProperties: false,
} as const;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function isLiveMode(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Moteur d'agent : un tour de conversation.
 * - Avec ANTHROPIC_API_KEY : appel réel à l'API Anthropic (sortie structurée).
 * - Sans clé : moteur de simulation déterministe (mêmes types, même contrat).
 */
export async function runAgentTurn(
  config: AgentConfig,
  messages: ChatMessage[],
): Promise<{ result: AgentTurnResult; mode: "live" | "mock" }> {
  if (!isLiveMode()) {
    return { result: runMockAgent(config, messages), mode: "mock" };
  }

  const client = new Anthropic(); // lit ANTHROPIC_API_KEY ; retries automatiques (2)

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: buildSystemPrompt(config),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      output_config: {
        format: { type: "json_schema", schema: TURN_RESULT_SCHEMA },
      },
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    if (!textBlock) {
      throw new Error(`Réponse sans bloc texte (stop_reason: ${response.stop_reason})`);
    }

    const parsed = JSON.parse(textBlock.text) as AgentTurnResult;
    return {
      result: { ...parsed, qualificationScore: clampScore(parsed.qualificationScore) },
      mode: "live",
    };
  } catch (error) {
    // Chaîne d'erreurs typées : du plus spécifique au plus général.
    if (error instanceof Anthropic.RateLimitError) {
      console.error("[agent] Rate limit Anthropic :", error.message);
      throw new AgentEngineError("rate_limited", "L'agent est temporairement saturé.");
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("[agent] Clé API invalide.");
      throw new AgentEngineError("auth", "Configuration API invalide.");
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[agent] Erreur API Anthropic :", error.status, error.message);
      throw new AgentEngineError("api", "Le moteur de l'agent a rencontré une erreur.");
    }
    console.error("[agent] Erreur inattendue :", error);
    throw new AgentEngineError("unknown", "Erreur inattendue du moteur.");
  }
}

export class AgentEngineError extends Error {
  constructor(
    public readonly code: "rate_limited" | "auth" | "api" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "AgentEngineError";
  }
}
