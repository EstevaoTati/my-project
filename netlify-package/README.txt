Mwinda Digital — package Netlify (aperçu statique de la home)
==============================================================

DÉPLOIEMENT (2 minutes) :
1. Allez sur https://app.netlify.com/drop
2. Glissez-déposez CE DOSSIER (ou le contenu du zip) sur la zone de dépôt.
3. Netlify publie index.html immédiatement et vous donne une URL live.

CONTENU :
- index.html   → la home (hero orbe 3D animé, offre, tarifs, toggle FR/EN)
- netlify.toml → config de publication + en-têtes de sécurité
- robots.txt

PORTÉE :
Ceci est la VITRINE STATIQUE de la Phase 1, idéale pour réserver vos premiers
diagnostics. L'application COMPLÈTE (espace de test des agents, dashboard client,
back-office admin, moteur Anthropic, Stripe) est une app Next.js 15 SSR — elle se
déploie sur Vercel avec une base PostgreSQL (voir le README du dépôt).
