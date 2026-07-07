// Seed de démonstration — Cabinet Kabongo Tax Services
// 15 conversations réalistes bilingues (FR/EN) pour les démos de vente.
// Exécution : npm run db:seed  (nécessite DATABASE_URL)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const P = "PROSPECT";
const A = "AGENT";

/** [role, contenu] — le dernier message AGENT porte le score/action de la conversation */
const CONVERSATIONS = [
  {
    prospectName: "Marie Tshilombo",
    prospectEmail: "marie.tshilombo@example.com",
    language: "FR",
    score: 88,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "Courrier IRS CP2000, échéance le 28. Dossier urgent et qualifié. RDV proposé demain 10 h 30 ou 15 h. Prospect francophone, W-2 unique, résidente WA.",
    messages: [
      [P, "Bonjour, j'ai reçu une lettre CP2000 de l'IRS et je dois répondre avant le 28. Je suis paniquée."],
      [A, "Bonjour Madame, je suis l'assistant du cabinet — je traite votre demande initiale et un préparateur vous répondra personnellement. Un CP2000 avec échéance proche est traité en priorité ici. Ne répondez pas vous-même à la lettre. Avez-vous vos documents de revenus (W-2, 1099) de l'année concernée ?"],
      [P, "Oui j'ai mon W-2, je travaille pour un seul employeur à Seattle."],
      [A, "Parfait, votre dossier est simple à préparer. Je vous propose un rendez-vous dès demain : 10 h 30 ou 15 h 00. Apportez la lettre et votre W-2 — le préparateur s'occupe de la réponse à l'IRS."],
    ],
  },
  {
    prospectName: "James Okafor",
    prospectEmail: "j.okafor@example.com",
    language: "EN",
    score: 82,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "Première déclaration US (arrivé en 2025, visa H-1B). Revenus W-2 + compte bancaire étranger. Qualifié — RDV proposé jeudi. Anglophone.",
    messages: [
      [P, "Hi, I moved to the US last year on an H-1B and I've never filed US taxes. Where do I start?"],
      [A, "Hello, and welcome! I'm the firm's assistant — a preparer will follow up personally. First-year filings are one of our specialties. Two quick questions: did you receive a W-2 from your employer, and do you keep any bank accounts abroad?"],
      [P, "Yes, one W-2, and I still have my account back home in Nigeria."],
      [A, "Thank you — that's important: foreign accounts may require an extra form, and the preparer will confirm exactly what applies to you. I can offer Thursday 11 am or Friday 2 pm for a first-filing consultation. Which works best?"],
    ],
  },
  {
    prospectName: "Fatou Ndiaye",
    prospectEmail: "fatou.ndiaye@example.com",
    language: "FR",
    score: 55,
    action: "ESCALATE",
    status: "ESCALATED",
    summary:
      "Demande le montant exact de son remboursement avant tout rendez-vous. Garde-fou appliqué (aucune promesse de résultat). Escaladé pour rappel humain sous 24 h.",
    messages: [
      [P, "Bonjour, combien je vais récupérer si je déclare avec vous ? Mon amie a eu 4 000 $."],
      [A, "Bonjour ! Je suis l'assistant du cabinet. C'est une excellente question, mais je ne peux pas annoncer de montant : chaque situation fiscale est unique et seule l'analyse de votre dossier par le préparateur peut y répondre sérieusement. Je transmets votre demande à l'équipe — un membre qualifié vous rappellera sous 24 h. Puis-je noter votre disponibilité ?"],
    ],
  },
  {
    prospectName: "David Mwangi",
    prospectEmail: "d.mwangi@example.com",
    language: "EN",
    score: 74,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "Chauffeur rideshare (1099), n'a pas déclaré ses dépenses. Bon potentiel, dossier self-employed classique. RDV proposé mardi.",
    messages: [
      [P, "I drive for Uber and Lyft. Last year I just filed the standard way and I think I paid too much."],
      [A, "Hello! I'm the firm's assistant — a preparer will take over personally. Rideshare drivers often leave real money on the table without expense tracking. Do you have your 1099s and an idea of your mileage for the year?"],
      [P, "I have the 1099s and the app tracks my miles."],
      [A, "Excellent — with mileage records, the preparer can review your last filing and set you up properly for this year. Tuesday 9 am or Wednesday 4 pm are open. Which do you prefer?"],
    ],
  },
  {
    prospectName: "Aïcha Diabaté",
    prospectEmail: "aicha.diabate@example.com",
    language: "FR",
    score: 90,
    action: "ESCALATE",
    status: "ESCALATED",
    summary:
      "Avis de saisie sur salaire IRS reçu, très anxieuse. Situation sensible et urgente : escalade immédiate avec priorité haute. À rappeler aujourd'hui.",
    messages: [
      [P, "On m'a dit que l'IRS va saisir mon salaire ! J'ai reçu un papier, je ne dors plus. Aidez-moi s'il vous plaît."],
      [A, "Bonjour, je comprends votre inquiétude et je vous rassure : ce type de situation se gère, surtout quand on agit vite. Je suis l'assistant du cabinet et je transmets immédiatement votre dossier en priorité haute — un préparateur vous appellera aujourd'hui même. Pour préparer cet appel : quelle est la référence indiquée en haut du courrier, et quelle date limite mentionne-t-il ?"],
      [P, "C'est écrit LT11, date limite dans 12 jours."],
      [A, "Merci. Un LT11 laisse des options quand on répond dans les délais — et 12 jours suffisent si nous commençons maintenant. Votre dossier est transmis en urgence ; attendez notre appel d'ici la fin de journée et surtout, ne signez rien d'ici là."],
    ],
  },
  {
    prospectName: "Peter Banda",
    prospectEmail: "p.banda@example.com",
    language: "EN",
    score: 35,
    action: "RESPOND",
    status: "OPEN",
    summary:
      "Question générale sur les délais de dépôt, pas de besoin exprimé. En cours de qualification.",
    messages: [
      [P, "Hey, when is the tax deadline this year?"],
      [A, "Hello! I'm the firm's assistant. The federal filing deadline is generally April 15th. May I ask — will you be filing as an individual or do you also have business income? I can point you to the right preparer either way."],
    ],
  },
  {
    prospectName: "Solange Kimbembe",
    prospectEmail: "s.kimbembe@example.com",
    language: "FR",
    score: 79,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "Besoin d'un ITIN pour son mari nouvellement arrivé + déclaration conjointe. Dossier qualifié, RDV samedi proposé (préférence week-end).",
    messages: [
      [P, "Bonjour, mon mari vient d'arriver aux États-Unis, il n'a pas de numéro de sécurité sociale. On peut déclarer ensemble ?"],
      [A, "Bonjour ! Je suis l'assistant du cabinet — un préparateur vous confirmera tout personnellement. Bonne nouvelle : c'est une situation courante, qui passe par une demande d'ITIN pour votre mari. Le cabinet prépare ces dossiers régulièrement. Travaillez-vous en semaine ? Nous avons aussi des créneaux le samedi."],
      [P, "Le samedi c'est mieux pour nous deux."],
      [A, "Parfait : samedi 10 h ou samedi 13 h 30. Apportez vos pièces d'identité et le passeport de votre mari — le préparateur détaillera la procédure ITIN complète au rendez-vous."],
    ],
  },
  {
    prospectName: "Grace Adeyemi",
    prospectEmail: "g.adeyemi@example.com",
    language: "EN",
    score: 30,
    action: "RESPOND",
    status: "OPEN",
    summary:
      "Étudiante F-1, demande vague sur l'obligation de déclarer. Qualification en cours — probablement dossier simple 8843/1040-NR.",
    messages: [
      [P, "I'm an international student, do I even need to file taxes? I only had a small campus job."],
      [A, "Hello! I'm the firm's assistant. Even with a small campus job, students on F-1 visas usually have at least one form to file — and it's often quick. Did you receive a W-2 from the campus job, and which year did you arrive in the US?"],
    ],
  },
  {
    prospectName: "Emmanuel Kasongo",
    prospectEmail: "e.kasongo@example.com",
    language: "FR",
    score: 85,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "3 années de déclarations en retard (2022-2024), veut régulariser avant une demande de carte verte. Dossier qualifié et motivé. RDV proposé lundi.",
    messages: [
      [P, "Bonjour. Je n'ai pas déclaré depuis 3 ans et j'ai besoin de régulariser pour mon dossier d'immigration. C'est possible ?"],
      [A, "Bonjour, merci pour votre confiance. Oui, la régularisation de déclarations tardives est tout à fait possible et le cabinet la pratique couramment — je précise que je suis l'assistant du cabinet, et qu'un préparateur pilotera personnellement votre dossier. Avez-vous vos documents de revenus (W-2/1099) pour ces trois années, même partiellement ?"],
      [P, "J'ai presque tout, il me manque juste un W-2 de 2022."],
      [A, "Très bien — le préparateur pourra vous aider à récupérer le document manquant auprès de l'IRS. Vu l'enjeu immigration, je vous propose de commencer dès lundi : 9 h 30 ou 14 h. Quel créneau vous convient ?"],
    ],
  },
  {
    prospectName: "Linda Mensah",
    prospectEmail: "l.mensah@example.com",
    language: "EN",
    score: 52,
    action: "ESCALATE",
    status: "ESCALATED",
    summary:
      "Demande si déclarer un revenu « cash » est obligatoire — question de fond fiscale/limite légale. Garde-fou appliqué : aucun avis donné, escaladé au préparateur.",
    messages: [
      [P, "If I got paid partly in cash, do I really have to report all of it? Nobody declares that, right?"],
      [A, "Hello — I'm the firm's assistant, and that's exactly the kind of question I make sure a professional answers directly rather than me: reporting obligations are a matter for the preparer to walk you through properly, and the firm will give you accurate guidance, not shortcuts. I'm forwarding your question to the team — may I set up a quick call for tomorrow morning or afternoon?"],
    ],
  },
  {
    prospectName: "Yves Mabiala",
    prospectEmail: "y.mabiala@example.com",
    language: "FR",
    score: 71,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "Petite entreprise de nettoyage (LLC) créée cette année, première déclaration d'entreprise. Qualifié. RDV proposé mercredi.",
    messages: [
      [P, "Bonsoir, j'ai monté ma LLC de nettoyage en février. C'est ma première année, je fais comment pour les impôts de l'entreprise ?"],
      [A, "Bonsoir et félicitations pour votre entreprise ! Je suis l'assistant du cabinet — un préparateur suivra personnellement votre dossier. Première année de LLC = bonnes fondations à poser (choix fiscal, dépenses déductibles, acomptes trimestriels). Êtes-vous seul propriétaire, ou avec un associé ?"],
      [P, "Seul propriétaire, et j'ai un employé à mi-temps."],
      [A, "C'est noté — avec un employé, il y a aussi les obligations de paie à vérifier. Le préparateur peut tout passer en revue mercredi : 10 h ou 15 h 30. Lequel vous arrange ?"],
    ],
  },
  {
    prospectName: "Robert Kiprop",
    prospectEmail: "r.kiprop@example.com",
    language: "EN",
    score: 25,
    action: "RESPOND",
    status: "OPEN",
    summary:
      "Demande de comparaison avec un logiciel gratuit. Intérêt faible à ce stade, argumentaire de valeur donné, qualification à poursuivre.",
    messages: [
      [P, "Why would I pay you when TurboTax is basically free?"],
      [A, "Fair question! I'm the firm's assistant. Software works well for simple, single-W-2 situations. Where a preparer earns their fee is when life isn't simple: self-employment, a move between states, IRS letters, first filings, credits people miss. Out of curiosity — is your situation a single W-2, or is there more to it this year?"],
    ],
  },
  {
    prospectName: "Chantal Bemba",
    prospectEmail: "c.bemba@example.com",
    language: "FR",
    score: 77,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "A déménagé de WA vers l'Oregon en cours d'année, double obligation d'État. Qualifiée, RDV proposé vendredi. Préfère visio.",
    messages: [
      [P, "Bonjour, j'ai déménagé de Seattle à Portland en juillet. Ça change quoi pour mes impôts ?"],
      [A, "Bonjour ! Je suis l'assistant du cabinet — un préparateur vous répondra personnellement. Un déménagement WA → OR en cours d'année crée effectivement une situation à deux États, et l'Oregon a un impôt sur le revenu. Le cabinet gère ces dossiers « part-year resident » couramment. Préférez-vous un rendez-vous au bureau ou en visio ?"],
      [P, "En visio, je suis à Portland maintenant."],
      [A, "Parfait — vendredi 11 h ou vendredi 16 h en visio. Ayez vos W-2 et vos dates de déménagement à portée de main ; le préparateur calculera la répartition entre les deux États."],
    ],
  },
  {
    prospectName: "Samuel Osei",
    prospectEmail: "s.osei@example.com",
    language: "EN",
    score: 68,
    action: "PROPOSE_APPOINTMENT",
    status: "APPOINTMENT_PROPOSED",
    summary:
      "Envoie de l'argent à sa famille au Ghana, veut savoir si des crédits s'appliquent et optimiser sa déclaration. RDV proposé jeudi.",
    messages: [
      [P, "Hello, I support my parents back in Ghana. Someone told me there might be tax benefits for that?"],
      [A, "Hello! I'm the firm's assistant — a preparer will confirm what applies to your exact situation, since dependent rules have precise conditions I won't guess at. It's a question we hear often from the diaspora, and worth an expert look at your whole return. Would Thursday 10 am or 3 pm work for a review?"],
      [P, "Thursday 3 pm works."],
      [A, "Booked for Thursday 3 pm — the preparer will review your support situation and your full return for any credits you're entitled to. Please bring last year's return and your W-2."],
    ],
  },
  {
    prospectName: "Nadia Haddad",
    prospectEmail: "n.haddad@example.com",
    language: "FR",
    score: 45,
    action: "RESPOND",
    status: "OPEN",
    summary:
      "Se renseigne pour sa mère (revenus de retraite étrangère). Intérêt réel mais informations incomplètes — questions posées, en attente de réponse.",
    messages: [
      [P, "Bonjour, c'est pour ma mère : elle touche une petite retraite de l'étranger et vit avec nous maintenant. Elle doit déclarer quelque chose ici ?"],
      [A, "Bonjour ! Je suis l'assistant du cabinet — un préparateur confirmera précisément ses obligations. Pour l'orienter : votre mère a-t-elle un statut de résidente fiscale aux États-Unis (carte verte, présence sur l'année), et sa retraite est-elle versée sur un compte américain ou étranger ?"],
    ],
  },
];

async function main() {
  console.log("— Seed Mwinda Digital : Cabinet Kabongo Tax Services —");

  // Idempotent : on repart de zéro pour l'organisation de démo
  const existing = await prisma.organization.findUnique({
    where: { slug: "kabongo-tax" },
  });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.id } });
    console.log("Organisation de démo existante supprimée (re-seed).");
  }

  const org = await prisma.organization.create({
    data: {
      name: "Cabinet Kabongo Tax Services",
      slug: "kabongo-tax",
      contactEmail: "contact@kabongo-tax.example.com",
      draftMode: true,
      agentConfig: {
        create: {
          profession: "TAX",
          tone: "PROFESSIONAL",
          languages: "BOTH",
          customRules:
            "Le cabinet est fermé le dimanche. Les rendez-vous du samedi sont réservés aux dossiers famille/ITIN. Mentionner que le parking est gratuit derrière le bâtiment quand un rendez-vous au bureau est confirmé.",
        },
      },
    },
  });
  console.log(`Organisation créée : ${org.name} (${org.slug})`);

  let day = 1;
  for (const convo of CONVERSATIONS) {
    // Étale les conversations sur le mois écoulé pour des démos réalistes
    const base = new Date();
    base.setDate(base.getDate() - (30 - day * 2));
    base.setHours(9 + (day % 9), 12, 0, 0);

    const created = await prisma.conversation.create({
      data: {
        organizationId: org.id,
        channel: day % 3 === 0 ? "WEB_FORM" : "EMAIL",
        prospectName: convo.prospectName,
        prospectEmail: convo.prospectEmail,
        detectedLanguage: convo.language,
        qualificationScore: convo.score,
        recommendedAction: convo.action,
        summaryForHuman: convo.summary,
        status: convo.status,
        createdAt: base,
      },
    });

    let offsetMin = 0;
    for (const [role, content] of convo.messages) {
      const isAgent = role === A;
      await prisma.message.create({
        data: {
          conversationId: created.id,
          role,
          content,
          status: "SENT",
          modelUsed: isAgent ? "claude-sonnet-4-6" : null,
          qualificationScore: isAgent ? convo.score : null,
          createdAt: new Date(base.getTime() + offsetMin * 60_000),
        },
      });
      offsetMin += isAgent ? 2 : 45; // l'agent répond en ~2 min, le prospect en ~45
    }

    if (convo.action === "PROPOSE_APPOINTMENT") {
      await prisma.appointment.create({
        data: {
          conversationId: created.id,
          proposedSlots: "Voir dernier message de l'agent",
          status: "PROPOSED",
        },
      });
    }
    day += 1;
  }

  const [convCount, msgCount, apptCount] = await Promise.all([
    prisma.conversation.count({ where: { organizationId: org.id } }),
    prisma.message.count({
      where: { conversation: { organizationId: org.id } },
    }),
    prisma.appointment.count({
      where: { conversation: { organizationId: org.id } },
    }),
  ]);
  console.log(
    `Seed terminé : ${convCount} conversations, ${msgCount} messages, ${apptCount} rendez-vous proposés.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
