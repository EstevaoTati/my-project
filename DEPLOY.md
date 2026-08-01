# Landing page — AI Consultant & Agentic Operating Systems

## 1. Mise en ligne (30 secondes)

1. Aller sur **https://app.netlify.com/drop**
2. Glisser-déposer ce dossier (ou le ZIP).
3. C'est en ligne. **La vidéo de fond joue immédiatement**, sans rien configurer.

Le formulaire `portfolio-contact` est détecté automatiquement par Netlify :
les soumissions arrivent dans l'onglet **Forms** du dashboard.

## 2. La vidéo de fond — comment elle est servie

Le fond du site est composé de **deux couches**, toutes deux animées en
permanence pendant tout le scroll (la couche est en `position:fixed`) :

1. **Réseau neuronal** calculé en direct dans la page — nœuds ambre qui
   dérivent, liens de proximité, points de données émeraude pulsants.
   Toujours actif, aucun fichier, aucun réseau.
2. **Clip 3D de 8 s généré sur Higgsfield** (Seedance 1.5) à partir d'un
   composite de vos trois images de référence : le portrait au centre, les
   deux visuels tech en hologrammes d'arrière-plan, tous textes et chiffres
   supprimés. Joué en boucle, muet, à **62 % d'opacité** sous un voile
   dégradé — nettement visible, sans nuire à la lisibilité.

La vidéo est servie **depuis votre propre domaine** : `netlify.toml`
déclare un proxy sur `/assets/clips/bg-tech.mp4`, donc Netlify va chercher
le fichier chez Higgsfield et le renvoie en même origine. Le navigateur du
visiteur ne contacte aucun serveur externe.

### La vidéo ne s'arrête jamais

La couche vidéo est protégée contre tous les cas d'arrêt : relance immédiate
sur `pause` / `ended` / `stalled` / `waiting`, reprise au retour d'onglet, au
dégel de page et à la première interaction si l'autoplay a été refusé, et un
chien de garde toutes les 3 s qui remonte la couche si elle est retirée du
DOM, si le flux se fige, ou si le réseau était indisponible au chargement.

Vérifié au navigateur, dont un test d'endurance de 60 s avec pauses forcées
et scrolls : **aucun échantillon en pause, un seul élément vidéo**.
Exception volontaire : `prefers-reduced-motion`, où la vidéo reste coupée
pour l'accessibilité.

### Rendre la vidéo totalement indépendante (recommandé à terme)

L'URL Higgsfield peut expirer un jour. Une commande suffit pour intégrer le
fichier au paquet :

```bash
./fetch-video.sh
```

Le script télécharge la vidéo dans `assets/clips/bg-tech.mp4`. Redéployez :
le fichier local est servi en priorité sur le proxy (`force = false`), sans
aucune modification de code.

## 3. Contenu à confirmer avant mise en ligne

- **URL LinkedIn** dans `index.html` — actuellement `linkedin.com/in/estevao-macumba`.
- **Les chiffres** : 4+ années d'expérience · 50+ clients accompagnés ·
  15+ masterclass & programmes de formation · 43 projets livrés.

## 4. Ce que contient le paquet

| Fichier | Rôle |
|---|---|
| `index.html` | Le site complet (une seule page, FR/EN) |
| `vendor/gsap.min.js`, `ScrollTrigger.min.js` | Moteur d'animation, auto-hébergé |
| `vendor/fonts.css` | Chakra Petch + JetBrains Mono en woff2 base64 (aucun CDN de polices) |
| `assets/estevao-graded.jpg` | Portrait étalonné de la carte 3D |
| `assets/hero/og-frame.jpg` | Image Open Graph 1200×630 |
| `assets/README.md` | Documentation des assets et de la génération Higgsfield |
| `netlify.toml` | Proxy vidéo, en-têtes de sécurité, cache |
| `fetch-video.sh` | Rapatrie la vidéo pour un hébergement 100 % local |
| `favicon.svg`, `robots.txt` | Icône et indexation |

## 5. Accessibilité et performance

- `prefers-reduced-motion` respecté : la vidéo, le décodage typographique et
  les effets sont désactivés, le site reste entièrement lisible.
- Tout est auto-hébergé et mis en cache de façon agressive (`vendor/`
  immuable un an), aucune requête tierce au chargement.
- Politique de sécurité du contenu stricte, en-têtes HSTS et anti-sniffing.
