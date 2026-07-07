# Mwinda Digital — AI Agents Agency

> « Mwinda » signifie **lumière** en lingala. Nous capturons les clients que vous perdez.

Plateforme SaaS de **Mwinda Group LLC** (Seattle, WA) : des agents IA « Réception Client 24/7 » bilingues FR/EN pour les cabinets de services professionnels de la diaspora africaine et francophone aux USA (impôts, immigration, assurance).

## État du projet

| Phase | Contenu | Statut |
|---|---|---|
| **Phase 1** | Site vitrine public bilingue (accueil, comment ça marche, tarifs, pages métier, contact) | ✅ Livrée |
| **Espace de test** | `/sandbox` — conversation avec l'agent, score de qualification, action recommandée | ✅ Livré |
| **Phase 2** | Moteur d'agent production : modèle de données complet, webhook entrant, mode brouillon, journalisation, seed de démo | ✅ Livrée (backend) |
| Phase 3 | Dashboard client (vue d'ensemble, boîte de conversations, file de validation, rapports) | ⏳ À venir |
| Phase 4 | Back-office admin + Stripe | ⏳ À venir |

## Stack

- **Next.js 15** (App Router) + **TypeScript strict** (zéro `any`)
- **Tailwind CSS 4** — thème « lumière qui perce » (bleu nuit `#0A0F1E`, ambre `#F5A623`)
- **next-intl** — FR par défaut, EN complet, aucun texte codé en dur
- **PostgreSQL via Prisma** — modèle `Lead` (formulaire diagnostic)
- **API Anthropic** (`claude-sonnet-4-6`) — moteur conversationnel avec sortie structurée
- **Resend** — notification email des nouveaux leads
- Déploiement cible : **Vercel**

## Installation

```bash
git clone <repo>
cd my-project
npm install
cp .env.example .env.local   # puis remplir les variables
npm run db:push              # crée les tables (nécessite DATABASE_URL)
npm run dev                  # http://localhost:3000
```

### Variables d'environnement

Toutes documentées dans [`.env.example`](.env.example). **Le site fonctionne en mode dégradé sans aucune clé** :

| Variable | Sans elle |
|---|---|
| `DATABASE_URL` | Les leads ne sont pas persistés (log serveur + email seulement) |
| `ANTHROPIC_API_KEY` | `/sandbox` tourne en **mode simulation** (réponses pré-écrites, même contrat de données) |
| `RESEND_API_KEY` | Pas d'email de notification (le lead reste en base) |

## L'espace de test (`/sandbox`)

C'est l'outil de démonstration et de validation des agents :

- **Configuration** : métier (impôts / immigration / assurance) + ton de l'agent
- **Conversation** : écrivez comme un prospect, en FR ou EN — l'agent détecte la langue
- **Analyse en direct** : score de qualification (0-100), action recommandée (répondre / proposer RDV / escalader), résumé en 5 lignes pour l'humain — exactement le contrat de données du futur dashboard (Phase 3)

Le moteur (`src/lib/agent/engine.ts`) construit dynamiquement le prompt système avec les **5 garde-fous non négociables** :

1. Jamais de conseil juridique / fiscal / assurance
2. Jamais de prix ferme ni de promesse de résultat
3. Mention systématique qu'un assistant traite la demande initiale
4. Détection de la langue du prospect et réponse dans cette langue (FR/EN)
5. Escalade au moindre doute, avec résumé en 5 lignes

Deux modes, même contrat TypeScript (`AgentTurnResult`) :
- **Live** (`ANTHROPIC_API_KEY` présente) : appel réel à l'API Anthropic avec sortie structurée JSON Schema
- **Mock** (sans clé) : moteur déterministe pour les démos hors ligne — le garde-fou « prix » déclenche bien une escalade, la détection de langue fonctionne

## Le moteur d'agent (Phase 2)

Modèle de données (`prisma/schema.prisma`) : `Organization` (cabinet, avec `draftMode`), `AgentConfig` (métier, ton, langues, règles custom), `Conversation`, `Message` (journal intégral, statuts `DRAFT/APPROVED/SENT/REJECTED`), `Appointment`, `MonthlyReport`.

Flux de production :

```
POST /api/webhooks/inbound          (header x-mwinda-webhook-secret: $WEBHOOK_SECRET)
{ organizationSlug, prospectEmail, prospectName?, content, channel?, conversationId? }
  → charge Organization + AgentConfig
  → journalise le message prospect
  → AgentEngine (prompt dynamique : métier + ton + garde-fous + règles custom)
  → journalise la réponse : DRAFT si draftMode, sinon SENT
  → met à jour score / action / résumé / statut de la conversation

PATCH /api/drafts/:id               (même secret)
{ action: "approve"|"reject", editedContent? }   ← file de validation du mode brouillon
```

### Seed de démonstration

```bash
npm run db:seed
```

Crée « Cabinet Kabongo Tax Services » (`slug: kabongo-tax`, mode brouillon actif, règles custom) avec **15 conversations bilingues réalistes** (scores 25→90, les 3 actions représentées, garde-fous illustrés : demandes de prix escaladées, aucune promesse de résultat) réparties sur le mois écoulé — prêtes pour les démos de vente et le futur dashboard.

Test manuel du webhook (après `db:push` + `db:seed`, avec `WEBHOOK_SECRET` définie) :

```bash
curl -X POST http://localhost:3000/api/webhooks/inbound \
  -H "Content-Type: application/json" \
  -H "x-mwinda-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"organizationSlug":"kabongo-tax","prospectEmail":"nouveau@prospect.com","content":"Bonjour, j'\''ai reçu une lettre de l'\''IRS"}'
```

## Déploiement sur Vercel

1. Importer le repo sur [vercel.com](https://vercel.com) (framework auto-détecté : Next.js)
2. Configurer les variables d'environnement du `.env.example` (Production + Preview)
3. Base recommandée : [Supabase](https://supabase.com) ou [Neon](https://neon.tech) — copier l'URL Postgres dans `DATABASE_URL`
4. Lancer une première migration : `npx prisma db push` en local pointé sur la base de prod, ou via un job
5. Déployer — le build exécute `prisma generate && next build`

## Structure

```
messages/{fr,en}.json          Tout le contenu du site (i18n)
prisma/schema.prisma           Modèle Lead + enums
src/i18n/                      Routing next-intl (FR défaut, EN préfixé /en)
src/app/[locale]/              Pages : accueil, comment-ca-marche, tarifs,
                               metiers/[slug], contact, sandbox
src/app/api/leads/             POST — enregistre le lead + email Resend
src/app/api/sandbox/chat/      POST — un tour d'agent ; GET — mode live/mock
src/lib/agent/                 Moteur : prompt système + garde-fous,
                               sortie structurée, mock déterministe
src/components/                Header, Footer, calculateur, FAQ, formulaire, sandbox
legacy-static/                 Ancien site statique (archivé)
```

## Ajouter un client (aujourd'hui / demain)

- **Aujourd'hui (Phase 1)** : les leads arrivent via `/contact` → base + email. Les pilotes sont servis en semi-manuel.
- **Phase 2** : chaque cabinet aura une `Organization` + `AgentConfig` (métier, ton, règles, mode brouillon) ; le moteur de `src/lib/agent/engine.ts` est déjà écrit pour être paramétré par cette config.

## Engagement de confidentialité

Aucune donnée client n'est utilisée pour entraîner un quelconque modèle d'IA. Cet engagement figure sur le site public et est contractuel.
