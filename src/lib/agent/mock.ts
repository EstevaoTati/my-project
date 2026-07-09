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

// ── Agents fonctionnels (catalogue) : scripts mock déterministes ──────────
interface FnScript {
  escalate: string[]; // déclencheurs d'escalade propres à la fonction
  greetFr: string;
  greetEn: string;
  progressFr: string;
  progressEn: string;
  escFr: string;
  escEn: string;
  sum1: string;
  sum2: string;
  sumEsc: string;
}

const PRICE_ADVICE = [
  "combien",
  "prix",
  "tarif",
  "how much",
  "price",
  "cost",
  "montant",
  "remboursement",
  "refund",
];

const FUNCTION_SCRIPTS: Record<string, FnScript> = {
  customer_service: {
    escalate: [...PRICE_ADVICE, "remboursez", "porter plainte", "avocat", "inacceptable", "scandaleux", "sue", "lawyer", "complaint"],
    greetFr: "Bonjour ! Je suis l'assistant de {f} — je traite votre demande initiale et un membre de l'équipe suivra personnellement. Pour vous aider au mieux : votre demande concerne-t-elle une information, une commande en cours, ou une réclamation ?",
    greetEn: "Hello! I'm {f}'s assistant — I handle your initial request and a team member will follow up personally. To help you best: is your request about information, an existing order, or a complaint?",
    progressFr: "Merci, c'est noté. Je peux vous proposer un rappel ou un rendez-vous dès demain : 10 h 30 ou 15 h — lequel vous convient ?",
    progressEn: "Thank you, noted. I can offer a callback or an appointment as early as tomorrow: 10:30 am or 3 pm — which works?",
    escFr: "Je comprends, et je préfère confier cela à un responsable plutôt que d'y répondre moi-même : je ne peux ni promettre un geste commercial ni reconnaître une responsabilité. Je transmets votre dossier en priorité — un membre de {f} vous répondra très vite. Puis-je noter vos coordonnées ?",
    escEn: "I understand, and I'd rather hand this to a manager than answer it myself: I can't promise a gesture of goodwill or acknowledge liability. I'm forwarding your case as a priority — a member of {f} will get back to you shortly. May I take your contact details?",
    sum1: "Demande client entrante (service client). Nature en cours de qualification. Aucune urgence confirmée à ce stade.",
    sum2: "Demande client qualifiée : besoin identifié. Rappel/RDV proposé (2 créneaux). En attente de confirmation.",
    sumEsc: "Réclamation ou demande sensible (remboursement/responsabilité/menace de recours). Garde-fou appliqué : aucune promesse ni reconnaissance. Escaladé en priorité — rappel proposé.",
  },
  hr: {
    escalate: ["harcèlement", "harassment", "discrimination", "licenciement", "licencier", "fired", "termination", "conflit", "avocat", "lawyer", "dépression", "burnout", "maladie grave", "syndicat", "prud'hommes"],
    greetFr: "Bonjour ! Je suis l'assistant RH de {f} — je traite votre demande initiale et l'équipe RH suivra personnellement. Votre question porte-t-elle sur vos congés, votre paie, un document, ou une politique interne ?",
    greetEn: "Hello! I'm {f}'s HR assistant — I handle your initial request and the HR team will follow up personally. Is your question about leave, payroll, a document, or an internal policy?",
    progressFr: "Merci, c'est clair. Je prépare votre demande pour l'équipe RH et je peux vous proposer un point : mercredi 14 h ou jeudi 11 h. Quel créneau vous convient ?",
    progressEn: "Thank you, that's clear. I'm preparing your request for the HR team and can offer a check-in: Wednesday 2 pm or Thursday 11 am. Which works?",
    escFr: "Merci de votre confiance, et je vais confier ce sujet directement à un membre des RH plutôt que d'y répondre moi-même — c'est important qu'un humain qualifié s'en occupe, en toute confidentialité. Je transmets immédiatement et de façon confidentielle. Souhaitez-vous être recontacté(e) aujourd'hui ?",
    escEn: "Thank you for your trust — I'll hand this directly to a member of HR rather than answering it myself; it's important that a qualified person handles it, in full confidence. I'm forwarding it immediately and confidentially. Would you like to be contacted today?",
    sum1: "Demande salarié (RH). Nature en cours de qualification (congés/paie/document/politique). Aucune sensibilité détectée à ce stade.",
    sum2: "Demande salarié qualifiée (RH) : besoin identifié, préparé pour l'équipe. Point proposé (2 créneaux).",
    sumEsc: "SUJET SENSIBLE RH (harcèlement/licenciement/conflit/santé ou juridique). Garde-fou appliqué : aucun avis, aucune donnée d'autrui. Escaladé IMMÉDIATEMENT et confidentiellement, priorité haute.",
  },
  accounting: {
    escalate: [...PRICE_ADVICE, "je dois combien", "solde", "payer maintenant", "virement", "déductible", "fiscal", "impôt", "tax", "redressement", "urssaf"],
    greetFr: "Bonjour ! Je suis l'assistant comptable de {f} — je prépare votre dossier et le comptable validera personnellement. Votre demande concerne-t-elle une facture, une note de frais, une échéance, ou une pièce à transmettre ?",
    greetEn: "Hello! I'm {f}'s accounting assistant — I prepare your file and the accountant will validate personally. Is your request about an invoice, an expense report, a deadline, or a document to send?",
    progressFr: "Merci, c'est noté. J'ai réuni les éléments pour le comptable. Souhaitez-vous transmettre les pièces par email dès aujourd'hui, ou en discuter demain matin ou après-midi ?",
    progressEn: "Thank you, noted. I've gathered the details for the accountant. Would you like to send the documents by email today, or discuss them tomorrow morning or afternoon?",
    escFr: "C'est une bonne question, mais je préfère la confier au comptable plutôt que d'y répondre : je ne peux ni donner d'avis fiscal ou comptable, ni confirmer un montant. Je transmets votre demande — le comptable de {f} vous répondra précisément. Puis-je noter votre disponibilité ?",
    escEn: "That's a good question, but I'd rather hand it to the accountant than answer it: I can't give tax or accounting advice, nor confirm an amount. I'm forwarding your request — {f}'s accountant will reply precisely. May I note your availability?",
    sum1: "Demande comptable entrante. Nature en cours de qualification (facture/note de frais/échéance/pièce). Aucune décision requise à ce stade.",
    sum2: "Demande comptable qualifiée : éléments réunis pour le comptable. Transmission des pièces / échange proposé.",
    sumEsc: "Demande d'avis fiscal/comptable ou de confirmation de montant. Garde-fou appliqué : aucun avis, aucun montant, aucun paiement. Escaladé au comptable.",
  },
  administration: {
    escalate: ["signer", "signature", "engager", "valider le contrat", "confidentiel", "autorisation", "avocat", "juridique", "legal", "sign", "contract"],
    greetFr: "Bonjour ! Je suis l'assistant administratif de {f} — je traite votre demande initiale et le service concerné suivra. Votre demande porte-t-elle sur un rendez-vous, un document à transmettre, ou une information pratique ?",
    greetEn: "Hello! I'm {f}'s administrative assistant — I handle your initial request and the relevant department will follow up. Is your request about an appointment, a document to send, or practical information?",
    progressFr: "Merci, c'est enregistré. Je peux planifier cela : mardi 9 h ou mercredi 16 h, ou orienter votre document vers le bon service. Que préférez-vous ?",
    progressEn: "Thank you, recorded. I can schedule this: Tuesday 9 am or Wednesday 4 pm, or route your document to the right department. What do you prefer?",
    escFr: "Cette demande engage l'organisation, je préfère donc la confier à la personne habilitée plutôt que d'y répondre moi-même. Je la transmets au service concerné de {f}. Souhaitez-vous être recontacté(e) aujourd'hui ou demain ?",
    escEn: "This request commits the organization, so I'd rather hand it to the authorized person than answer it myself. I'm forwarding it to the relevant department at {f}. Would you like to be contacted today or tomorrow?",
    sum1: "Demande administrative entrante. Objet en cours de qualification (RDV/document/information). Aucune décision requise à ce stade.",
    sum2: "Demande administrative qualifiée : planification ou routage de document en cours.",
    sumEsc: "Demande engageant l'organisation (signature/validation/confidentiel). Garde-fou appliqué : aucune décision prise. Escaladé au service habilité.",
  },
  sales: {
    escalate: [...PRICE_ADVICE, "remise", "discount", "devis ferme", "contrat", "garantie", "guarantee", "délai de livraison", "roadmap"],
    greetFr: "Bonjour ! Je suis l'assistant commercial de {f} — je prépare votre échange et un commercial confirmera personnellement. Pour vous orienter : quel est votre besoin principal, et pour quelle échéance envisagez-vous une solution ?",
    greetEn: "Hello! I'm {f}'s sales assistant — I prepare your inquiry and a rep will confirm personally. To point you in the right direction: what's your main need, and by when are you considering a solution?",
    progressFr: "Merci, votre besoin est clair. Je vous propose une démonstration avec un commercial : jeudi 10 h ou vendredi 15 h. Lequel vous convient ?",
    progressEn: "Thank you, your need is clear. I can set up a demo with a rep: Thursday 10 am or Friday 3 pm. Which works?",
    escFr: "Excellente question, mais je préfère laisser un commercial vous répondre : je ne peux ni annoncer de prix ferme ni m'engager sur des conditions. Je transmets votre demande — un commercial de {f} reviendra vers vous rapidement. Puis-je réserver un créneau de démonstration ?",
    escEn: "Great question, but I'd rather let a rep answer: I can't quote a firm price or commit to terms. I'm forwarding your request — a {f} rep will get back to you quickly. May I book a demo slot?",
    sum1: "Prospect entrant (ventes). Besoin et échéance en cours de qualification. Budget et décideur à confirmer.",
    sum2: "Prospect qualifié (ventes) : besoin identifié. Démonstration proposée (2 créneaux).",
    sumEsc: "Demande de prix ferme / remise / conditions contractuelles. Garde-fou appliqué : aucun engagement. Escaladé à un commercial — démonstration proposée.",
  },
  it_support: {
    escalate: ["piratage", "intrusion", "fuite", "rançongiciel", "ransomware", "phishing", "hacked", "breach", "supprimer", "delete", "formater", "format", "mot de passe", "password"],
    greetFr: "Bonjour ! Je suis l'assistant support IT de {f} — je qualifie votre demande et un technicien prend le relais si besoin. Pouvez-vous décrire le problème, le matériel ou logiciel concerné, et un éventuel message d'erreur ?",
    greetEn: "Hello! I'm {f}'s IT support assistant — I triage your request and a technician takes over if needed. Can you describe the problem, the device or software involved, and any error message?",
    progressFr: "Merci, c'est clair. Je crée un ticket avec ces éléments. Un technicien peut vous rappeler : aujourd'hui 14 h ou demain 10 h. Quel créneau préférez-vous ?",
    progressEn: "Thank you, that's clear. I'm creating a ticket with these details. A technician can call you back: today 2 pm or tomorrow 10 am. Which slot do you prefer?",
    escFr: "C'est un point que je préfère confier immédiatement à un technicien plutôt que de le traiter moi-même — par sécurité, je ne guide aucune manipulation sensible ni ne traite de mot de passe. Je remonte votre demande en priorité auprès de l'équipe de {f}. Restez disponible, on vous recontacte au plus vite.",
    escEn: "This is something I'd rather hand to a technician immediately than handle myself — for safety, I don't guide sensitive actions or handle passwords. I'm escalating your request as a priority to {f}'s team. Please stay available; we'll get back to you very soon.",
    sum1: "Demande support IT entrante. Problème en cours de qualification (matériel/logiciel/erreur). Aucun incident de sécurité signalé à ce stade.",
    sum2: "Demande support IT qualifiée : ticket créé avec les éléments. Rappel technicien proposé (2 créneaux).",
    sumEsc: "INCIDENT SENSIBLE IT (sécurité/mot de passe/action destructrice). Garde-fou appliqué : aucune manipulation guidée. Escaladé IMMÉDIATEMENT à un technicien, priorité haute.",
  },
};

function runFunctionAgent(
  agentType: string,
  firmName: string,
  messages: ChatMessage[],
): AgentTurnResult {
  const script = FUNCTION_SCRIPTS[agentType];
  if (!script) {
    // Type inconnu : repli neutre sûr (escalade).
    return {
      reply: "Je transmets votre demande à un membre de l'équipe qui vous répondra personnellement.",
      qualificationScore: 40,
      recommendedAction: "ESCALATE",
      detectedLanguage: "FR",
      summaryForHuman: "Demande entrante non catégorisée. Escaladée par prudence.",
    };
  }
  const userTurns = messages.filter((m) => m.role === "user");
  const text = userTurns[userTurns.length - 1]?.content ?? "";
  const lang = detectLanguage(text);
  const fill = (s: string) => s.replaceAll("{f}", firmName);
  const lower = text.toLowerCase();

  if (script.escalate.some((k) => lower.includes(k))) {
    return {
      reply: fill(lang === "FR" ? script.escFr : script.escEn),
      qualificationScore: 55,
      recommendedAction: "ESCALATE",
      detectedLanguage: lang,
      summaryForHuman: script.sumEsc,
    };
  }
  if (userTurns.length <= 1) {
    return {
      reply: fill(lang === "FR" ? script.greetFr : script.greetEn),
      qualificationScore: 35,
      recommendedAction: "RESPOND",
      detectedLanguage: lang,
      summaryForHuman: script.sum1,
    };
  }
  return {
    reply: fill(lang === "FR" ? script.progressFr : script.progressEn),
    qualificationScore: 78,
    recommendedAction: "PROPOSE_APPOINTMENT",
    detectedLanguage: lang,
    summaryForHuman: script.sum2,
  };
}

export function runMockAgent(
  config: AgentConfig,
  messages: ChatMessage[],
): AgentTurnResult {
  // Agent fonctionnel (catalogue) prioritaire.
  if (config.agentType) {
    return runFunctionAgent(config.agentType, config.firmName, messages);
  }
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
