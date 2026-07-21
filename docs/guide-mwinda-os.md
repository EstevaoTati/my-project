# MWINDA OS — Le Guide Complet

*Documentation fondateur · MWINDA DIGITAL · version du 20 juillet 2026*

---

## Partie 1 — Le but du site

Le site **https://polite-cendol-dbf4d6.netlify.app** (bientôt sur votre domaine)
a trois missions, dans cet ordre :

**1. Vendre.** C'est la vitrine de MWINDA DIGITAL — un écosystème du monde
digital et de l'innovation technologique, dédié à la promotion des NTIC, de
l'intelligence artificielle et du déploiement de systèmes agentiques. Il
présente vos cinq pôles d'expertise :

| Pôle | Ce que le client achète |
|---|---|
| Systèmes Agentiques IA | Des agents autonomes (entreprise & B2C) déployés en production |
| L'Automatisation | Workflows intelligents, intégrations API & SaaS, opérations 24/7 |
| Formations IA | Ateliers pratiques, programmes entreprise, coaching dirigeants |
| Incubation Digitale | De l'idée au lancement : MVP, architecture, go-to-market |
| Intelligence Artificielle | Conseil, RAG & données, évaluation, déploiement & MLOps |

**2. Capturer les prospects.** Le formulaire de contact ne se contente pas
d'envoyer un email : à la soumission, **WhatsApp s'ouvre vers votre numéro
(+1 706 572 5957)** avec le nom, l'email, le pôle et le message du prospect
déjà rédigés. Le prospect appuie sur Envoyer — et la conversation commence
là où vous vivez déjà : votre téléphone.

**3. Prouver.** La page `/os` n'est pas du marketing : c'est la
**démonstration vivante** de ce que vous vendez. Un prospect qui discute
avec le widget « Talk to the OS » interagit avec un agent IA réellement
déployé — exactement le produit du pôle n°1. Le site ne dit pas « nous
savons faire » : il le montre.

Le site est bilingue (anglais par défaut, français au clic), déployé
automatiquement sur Netlify à chaque poussée sur la branche `main` du dépôt
GitHub `EstevaoTati/my-project`.

---

## Partie 2 — MWINDA OS : l'architecture complète

MWINDA OS est votre système d'exploitation exécutif : une infrastructure qui
transforme un fondateur seul en entreprise AI-native. Il n'est pas un
logiciel installé quelque part — c'est un **écosystème de fichiers, d'agents
et d'automatisations** ancré dans votre dépôt GitHub, qui se charge dans
chaque session de travail IA.

```
                    ┌─────────────────────────────────────┐
                    │  COUCHE 1 · LE KERNEL (CLAUDE.md)   │
                    │  identité · priorités · style       │
                    └──────────────────┬──────────────────┘
                                       │ se charge automatiquement
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   COUCHE 2        COUCHE 3        COUCHE 4        COUCHE 5       COUCHE 6
   AGENTS          ROUTINES        MÉMOIRE         CHAT WEB       BRIEFS
   architect       lundi 07:00     docs/decisions  /os public     Layer 06
   researcher      (extensible)    docs/briefs     + mode         clé requise
   strategist                      CLAUDE.md       fondateur
```

### Couche 1 — Le Kernel (`CLAUDE.md`)

Un seul fichier à la racine du dépôt. Il contient : qui vous êtes, vos 10
priorités ordonnées (protéger votre temps d'abord), les questions à poser
avant toute tâche, les checklists de construction logicielle et IA, le style
de communication (direct, sans flatterie, qui challenge les idées faibles),
et la discipline de mémoire. **Toute session Claude Code ouverte sur ce
dépôt le charge automatiquement** — vous ne répétez jamais votre contexte.

### Couche 2 — Les trois agents IA (`.claude/agents/`)

Trois spécialistes, chacun avec son mandat, ses règles et son format de
sortie. Ils travaillent **en parallèle** quand la tâche le permet.

### Couche 3 — Les routines (automatisations planifiées)

Des sessions qui se lancent seules, sans vous. La première : le **Brief du
Lundi** (07:00 UTC), qui relit tout le dépôt et livre vos priorités de la
semaine en PR brouillon.

### Couche 4 — La mémoire (le dépôt lui-même)

Le chat est éphémère ; le dépôt est éternel. Chaque décision importante va
dans `docs/decisions/` (une par fichier, datée). Chaque brief s'archive dans
`docs/briefs/`. Chaque préférence durable remonte dans le kernel. Résultat :
**le système devient plus intelligent chaque semaine**, car aucune
conclusion ne se perd.

### Couche 5 — Le chat web (`/os` sur le site)

Deux personnalités dans un seul widget (détaillé en Partie 3).

### Couche 6 — Les briefs sur le site

Vos briefs du lundi, lisibles depuis n'importe quel navigateur avec votre
clé fondateur.

---

## Partie 3 — Utiliser MWINDA OS : le mode d'emploi intégral

### 3.1 Depuis le site (n'importe où, même au téléphone)

1. Ouvrez **votre-site/os** (bouton doré flottant en bas à droite de
   l'accueil, ou « MWINDA OS » dans le menu).
2. Cliquez **« Talk to the OS »** sous l'animation de démarrage.
3. Tapez `/os VOTRE-CLÉ-FONDATEUR` → le libellé devient « Mwinda OS ·
   Kernel ». Vous parlez maintenant à votre chef de cabinet : posez vos
   dilemmes stratégiques, demandez des analyses, testez vos idées — il
   challenge, tranche et recommande selon vos 10 priorités.
4. Tapez `/public` pour rendre le chat au visiteur.
5. Descendez au **Layer 06 — Founder Briefs**, entrez la même clé : vos
   briefs du lundi s'affichent (si le mode kernel est déjà actif, ça se
   déverrouille tout seul).

**Limite assumée de ce canal :** c'est le cerveau de l'OS sans ses mains —
pas d'accès au dépôt, pas d'outils, pas de mémoire persistante. Quand une
vraie décision émerge de la conversation, l'OS vous dira lui-même de la
faire enregistrer via une session Claude Code.

### 3.2 Depuis Claude Code (la salle des machines — pleins pouvoirs)

C'est ici que l'OS a ses mains : lecture/écriture du dépôt, déploiements,
recherches web, création de routines.

1. Ouvrez **claude.ai/code** (web ou app mobile) → session sur le dépôt
   `EstevaoTati/my-project`.
2. Le kernel se charge seul. Parlez normalement : « améliore la page
   tarifs », « analyse ce contrat », « déploie X ». L'OS exécute, teste,
   pousse, fusionne.
3. Tout ce qui compte finit committé — c'est la règle de mémoire.

### 3.3 Invoquer les agents IA (leur mode d'emploi)

Dans une session Claude Code, appelez-les **par leur nom** :

**🏗 ARCHITECT** — *avant de construire quoi que ce soit*
```
use the architect agent: conçois la plateforme SaaS de gestion
de leads pour le pôle Automatisation
```
Livre : une architecture concrète, les coûts à 10 / 1 000 / 100 000
utilisateurs, un plan de construction semaine par semaine, et la meilleure
alternative qu'il a rejetée — avec ses raisons.

**🔎 RESEARCHER** — *avant de décider sur des faits externes*
```
use the researcher agent: compare les prix des bases vectorielles
pour un RAG de 100k documents
```
Livre : un brief lisible en 5 minutes — conclusion avec niveau de
confiance, faits sourcés avec dates et prix, implications pour Mwinda, une
prochaine étape dimensionnée.

**♟ STRATEGIST** — *avant d'engager votre temps ou votre argent*
```
use the strategist agent: client payant maintenant ou finir
le produit d'abord ?
```
Livre : une recommandation tranchée. Il tient un plafond dur de 3 priorités
actives et challenge tout ce qui ressemble à construire de l'infrastructure
avant du revenu.

**Les combiner (le vrai pouvoir) :** pour une grosse décision, demandez les
trois en parallèle — le researcher rassemble les faits, l'architect conçoit,
le strategist tranche. Exemple :
```
Je veux lancer une offre "agent IA clé en main pour PME à 500$/mois".
Utilise le researcher pour le marché, l'architect pour l'architecture
technique et le coût de revient, puis le strategist pour go/no-go.
```

---

## Partie 4 — Automatiser MWINDA OS

### 4.1 La routine existante : le Brief du Lundi

Chaque lundi 07:00 UTC, une session fraîche se réveille seule : elle relit
les 14 derniers jours du dépôt (PRs, commits, décisions), rédige un brief
d'une page — top 3 priorités, boucles ouvertes, tableau d'état — et ouvre
un PR brouillon dans `docs/briefs/`. Vous le lisez le lundi matin (sur
GitHub ou sur le site, Layer 06), vous fusionnez, il s'archive.

*État actuel : la routine a raté son premier rendez-vous (20 juillet) — le
brief a été produit manuellement. Le déclencheur doit être vérifié ; il
faut approuver la demande d'inspection d'outil quand elle apparaît dans une
session.*

### 4.2 Créer de nouvelles routines (le principe)

Toute tâche récurrente se transforme en routine par **une simple phrase**
dans une session Claude Code :

> « Crée une routine qui, chaque vendredi à 17h, relit les conversations
> WhatsApp de la semaine que je lui colle, et prépare le suivi des
> prospects. »

Routines recommandées pour la suite, par ordre de valeur :

| Routine | Cadence | Ce qu'elle livre |
|---|---|---|
| Brief du lundi *(existe)* | Lundi 07:00 | Priorités de la semaine |
| Veille IA & concurrents | Vendredi | 5 faits marquants + implications Mwinda |
| Santé du site | Quotidien | Vérifie que le site et le chat répondent, alerte sinon |
| Revue des leads | Mercredi | Relance des prospects sans réponse |
| Revue mensuelle | 1er du mois | Coûts API, trafic, décisions du mois |

### 4.3 La règle d'or de l'automatisation

**Chat éphémère → dépôt permanent.** Une automatisation qui ne laisse pas
de trace écrite dans le dépôt n'existe pas. Chaque routine doit livrer un
fichier, un PR ou une alerte — jamais juste « faire » en silence. C'est ce
qui rend le système auditable et cumulatif.

---

## Partie 5 — Déployer les agents IA

Trois canaux de déploiement, du plus simple au plus stratégique :

### Canal 1 — Le site (déjà en production ✅)

Votre premier agent déployé est **le widget du site** : fonction serverless
`netlify/functions/chat.mjs` → API Claude (`claude-opus-4-8`), clé protégée
côté serveur, garde-fous (limites d'entrée, kill switch, refus gérés).

Pour le piloter, trois variables dans Netlify (*Site settings → Environment
variables*) :
- `ANTHROPIC_API_KEY` — la clé (rotation : console.anthropic.com)
- `CHAT_MODEL` — changer de modèle sans toucher au code
  (`claude-haiku-4-5` = ~5× moins cher pour du trafic public)
- `CHAT_ENABLED=false` — coupe le chat instantanément (kill switch)
- `FOUNDER_KEY` — votre clé du mode kernel et des briefs

### Canal 2 — Telegram via Hermes (30 minutes, prêt à lancer)

L'OS dans votre poche : messages **et mémos vocaux** depuis votre téléphone.

1. Louez un petit VPS (~5 $/mois — Hetzner, DigitalOcean).
2. Dans Telegram : **@BotFather** → `/newbot` → copiez le token.
3. Sur le VPS, une seule commande :
```bash
ANTHROPIC_API_KEY=sk-ant-... TELEGRAM_BOT_TOKEN=123:abc ./scripts/deploy-hermes.sh
```
Le script (déjà dans le dépôt) installe tout, applique la configuration
vérifiée, fait le test de fumée, et installe le service qui survit aux
redémarrages. Sécurité : gardez le handle du bot privé, limitez qui peut
lui parler, gardez le plafond de dépenses actif.

### Canal 3 — Les agents pour vos clients (le business)

Le canal qui rapporte : **répliquer votre propre architecture pour les
clients**. Le pattern est celui que vous vendez au pôle n°1, et vous en
êtes la preuve vivante :

1. **Agent web B2C** — dupliquez le pattern du widget : une fonction
   serverless + un prompt métier (restaurant, cabinet comptable,
   immobilier…) + les mêmes garde-fous. Coût marginal quasi nul, déployé en
   jours, facturable en abonnement mensuel.
2. **Agent WhatsApp/Telegram d'entreprise** — le pattern Hermes avec le
   prompt du client : son FAQ, ses tarifs, sa prise de rendez-vous.
3. **La plateforme complète (PR #4, en réserve)** — une plateforme
   Next.js complète dort dans le dépôt : sandbox d'agents, dashboards
   client/admin, facturation Stripe. C'est la base produit toute prête le
   jour où vous industrialisez l'offre. Décision à prendre (cf. brief du
   20 juillet).

**Le pitch commercial que cette architecture autorise :** « Voici mon
agent — parlez-lui sur mon site. Le vôtre peut être en ligne dans une
semaine. »

---

## Partie 6 — Opérations, sécurité, coûts

| Sujet | Règle |
|---|---|
| Clé API | Jamais dans le code ni le chat. Uniquement en variable Netlify. Rotation après toute exposition. |
| Clé fondateur | Dans un gestionnaire de mots de passe. Elle dépense votre budget API. |
| Plafond | console.anthropic.com → Billing → limite mensuelle dure. C'est LE pare-feu anti-abus. |
| Coûts | Widget public : centimes par conversation (512 tokens max). Passez `CHAT_MODEL` sur Haiku si le trafic monte. |
| Urgence | `CHAT_ENABLED=false` dans Netlify = chat coupé en 1 minute. |
| Fichiers internes | `/docs/*`, `CLAUDE.md`, `/scripts/*` sont bloqués au public depuis le 20 juillet. |

---

## Partie 7 — Aide-mémoire (tout sur une carte)

| Je veux… | Je fais… |
|---|---|
| Parler à mon OS depuis le web | `votre-site/os` → chat → `/os MA-CLÉ` |
| Lire mes briefs | `votre-site/os.html#briefs` → ma clé → Unlock |
| Donner un vrai ordre exécuté | Session Claude Code sur le dépôt |
| Une architecture | `use the architect agent: …` |
| Une recherche sourcée | `use the researcher agent: …` |
| Une décision tranchée | `use the strategist agent: …` |
| Une nouvelle automatisation | « Crée une routine qui… » en session |
| L'OS sur Telegram | VPS + `./scripts/deploy-hermes.sh` |
| Changer le modèle du chat | Variable `CHAT_MODEL` dans Netlify |
| Tout couper | `CHAT_ENABLED=false` dans Netlify |
| Voir ce qui a été décidé et pourquoi | `docs/decisions/` sur GitHub |

---

*Ce guide vit dans `docs/guide-mwinda-os.md`. Comme tout dans MWINDA OS, il
est versionné : chaque évolution du système doit s'y refléter. Bringing
Light to Your Ideas.*
