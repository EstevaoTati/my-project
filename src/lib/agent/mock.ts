import type {
  AgentConfig,
  AgentTurnResult,
  ChatMessage,
  DetectedLanguage,
} from "./types";

/**
 * Moteur de simulation déterministe — utilisé quand ANTHROPIC_API_KEY est absente.
 * Reproduit le comportement de production (garde-fous, score, actions) avec des
 * réponses pré-écrites, pour que l'espace de test fonctionne partout (démos incluses).
 */

const EN_HINTS = [
  "hello", "hi ", "the ", "my ", "i ", "can you", "need", "help", "visa",
  "insurance", "please", "what", "how", "when", "expires", "letter",
];

function detectLanguage(text: string): DetectedLanguage {
  const lower = ` ${text.toLowerCase()} `;
  const enScore = EN_HINTS.filter((h) => lower.includes(h)).length;
  const frHints = ["bonjour", "bonsoir", "je ", "j'ai", "il me faut", "vous ", "merci", "besoin"];
  const frScore = frHints.filter((h) => lower.includes(h)).length;
  return enScore > frScore ? "EN" : "FR";
}

function wantsPriceOrAdvice(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    "combien", "prix", "tarif", "how much", "price", "cost",
    "est-ce que je vais gagner", "quelles sont mes chances", "my chances",
    "garantie", "guarantee", "récupérer", "refund",
  ].some((k) => lower.includes(k));
}

interface Script {
  firstFr: string;
  firstEn: string;
  secondFr: string;
  secondEn: string;
  summary1: string;
  summary2: string;
}

const SCRIPTS: Record<AgentConfig["profession"], Script> = {
  tax: {
    firstFr:
      "Bonjour ! Je suis l'assistant du cabinet {firm} — je traite votre demande initiale et un préparateur vous répondra personnellement. Pour vous orienter au mieux : votre demande concerne-t-elle une déclaration à venir, un courrier de l'IRS, ou une autre situation ? Et y a-t-il une échéance à respecter ?",
    firstEn:
      "Hello! I'm the assistant at {firm} — I handle your initial request and a preparer will follow up personally. To point you in the right direction: is your request about an upcoming filing, an IRS letter, or another situation? And is there a deadline involved?",
    secondFr:
      "Merci, c'est très clair. Votre situation correspond exactement à ce que le cabinet traite en priorité. Je peux vous proposer un rendez-vous dès demain : 10 h 30 ou 15 h 00 — lequel vous convient ? Apportez simplement vos documents, le préparateur s'occupe du reste.",
    secondEn:
      "Thank you, that's very clear. Your situation is exactly what the firm treats as a priority. I can offer you an appointment as early as tomorrow: 10:30 am or 3:00 pm — which works for you? Just bring your documents; the preparer will take it from there.",
    summary1:
      "Prospect entrant (impôts). Premier contact : nature de la demande en cours de qualification. Langue détectée et échéance demandées. Aucune urgence confirmée à ce stade.",
    summary2:
      "Prospect qualifié (impôts) : besoin identifié, échéance communiquée. Rendez-vous proposé (2 créneaux). En attente de confirmation du créneau.",
  },
  immigration: {
    firstFr:
      "Bonjour, et merci de nous avoir contactés. Je suis l'assistant du cabinet {firm} — je traite les demandes initiales et un avocat assurera personnellement le suivi. Pour préparer au mieux la consultation : quel type de procédure vous concerne, et y a-t-il une échéance ou une convocation en jeu ?",
    firstEn:
      "Hello, and thank you for reaching out. I'm the assistant at {firm} — I handle initial requests and an attorney will follow up personally. To best prepare the consultation: what type of procedure are you dealing with, and is there a deadline or a summons involved?",
    secondFr:
      "Merci pour ces précisions. Je ne me prononcerai pas sur le fond — c'est le rôle de l'avocat — mais votre délai justifie une consultation rapide. Cette semaine : mercredi 14 h ou jeudi 11 h sont disponibles. Quel créneau vous arrange ?",
    secondEn:
      "Thank you for the details. I won't comment on the merits — that's the attorney's role — but your timeline calls for a prompt consultation. This week: Wednesday 2 pm or Thursday 11 am are available. Which slot works for you?",
    summary1:
      "Prospect entrant (immigration). Type de procédure en cours d'identification. Vigilance : ne donner aucun avis juridique. Échéance à confirmer.",
    summary2:
      "Prospect qualifié (immigration) : procédure et échéance identifiées, dossier sensible au délai. Consultation proposée (2 créneaux). Aucun avis de fond donné.",
  },
  insurance: {
    firstFr:
      "Bonjour ! Je suis l'assistant de l'agence {firm} — je prépare votre dossier et l'agent vous confirmera personnellement la proposition. Je ne peux pas annoncer de tarif ferme, mais je peux tout préparer. Dites-moi : quel type d'assurance recherchez-vous, et pour quelle échéance ?",
    firstEn:
      "Hello! I'm the assistant at {firm} — I prepare your file and the agent will personally confirm the proposal. I can't quote a firm price, but I can prepare everything. Tell me: what type of insurance are you looking for, and by when do you need it?",
    secondFr:
      "Parfait, votre dossier est bien engagé. L'agent peut vous appeler dès demain pour finaliser la proposition : plutôt matin ou après-midi ? Ayez si possible vos justificatifs à portée de main (permis, relevé d'information).",
    secondEn:
      "Perfect — your file is well underway. The agent can call you as early as tomorrow to finalize the proposal: morning or afternoon? If possible, have your documents handy (license, insurance record).",
    summary1:
      "Prospect entrant (assurance). Type de couverture et échéance en cours de qualification. Rappel : aucun tarif ferme annoncé par l'agent.",
    summary2:
      "Prospect qualifié (assurance) : besoin et échéance identifiés, historique recueilli. Appel de finalisation proposé. La proposition tarifaire reste à l'agent humain.",
  },
};

const ESCALATE_FR =
  "C'est une excellente question, mais elle relève du professionnel : je ne suis pas habilité à annoncer un tarif ni à donner un avis de fond. Je transmets immédiatement votre dossier à l'équipe avec un résumé — un membre qualifié du cabinet {firm} vous répondra personnellement très vite. Puis-je confirmer votre disponibilité pour un échange demain ?";
const ESCALATE_EN =
  "That's an excellent question, but it's one for the professional: I'm not able to quote a price or give substantive advice. I'm forwarding your file to the team right away with a summary — a qualified member of {firm} will get back to you personally very soon. May I confirm your availability for a call tomorrow?";

export function runMockAgent(
  config: AgentConfig,
  messages: ChatMessage[],
): AgentTurnResult {
  const userTurns = messages.filter((m) => m.role === "user");
  const lastUser = userTurns[userTurns.length - 1];
  const text = lastUser?.content ?? "";
  const lang = detectLanguage(text);
  const script = SCRIPTS[config.profession];
  const fill = (s: string) => s.replace("{firm}", config.firmName);

  // Garde-fou n°2 : prix ferme / promesse / avis de fond → escalade
  if (wantsPriceOrAdvice(text)) {
    return {
      reply: fill(lang === "FR" ? ESCALATE_FR : ESCALATE_EN),
      qualificationScore: 55,
      recommendedAction: "ESCALATE",
      detectedLanguage: lang,
      summaryForHuman:
        "Le prospect demande un tarif ferme ou un avis professionnel. Garde-fou appliqué : aucune réponse de fond donnée. Dossier escaladé — rappel proposé sous 24 h. Contexte complet dans l'historique de conversation. Priorité : moyenne-haute.",
    };
  }

  if (userTurns.length <= 1) {
    return {
      reply: fill(lang === "FR" ? script.firstFr : script.firstEn),
      qualificationScore: 35,
      recommendedAction: "RESPOND",
      detectedLanguage: lang,
      summaryForHuman: script.summary1,
    };
  }

  return {
    reply: fill(lang === "FR" ? script.secondFr : script.secondEn),
    qualificationScore: 78,
    recommendedAction: "PROPOSE_APPOINTMENT",
    detectedLanguage: lang,
    summaryForHuman: script.summary2,
  };
}
