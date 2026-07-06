/** Types partagés du moteur d'agent (sandbox aujourd'hui, production Phase 2). */

export type AgentProfession = "tax" | "immigration" | "insurance";
export type AgentTone = "professional" | "formal" | "concise";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type RecommendedAction = "RESPOND" | "PROPOSE_APPOINTMENT" | "ESCALATE";
export type DetectedLanguage = "FR" | "EN";

/** Sortie structurée produite par l'agent pour chaque tour de conversation. */
export interface AgentTurnResult {
  reply: string;
  qualificationScore: number; // 0-100
  recommendedAction: RecommendedAction;
  detectedLanguage: DetectedLanguage;
  summaryForHuman: string; // résumé en 5 lignes max pour l'humain
}

export interface AgentConfig {
  profession: AgentProfession;
  tone: AgentTone;
  firmName: string;
}
