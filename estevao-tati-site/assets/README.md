# Assets — Landing page AI Consultant &amp; Agentic Operating Systems

## 1. Fond animé (en place ✓)

Le fond du site est composé de **deux couches superposées**, toutes deux
autonomes et permanentes (elles restent animées pendant tout le scroll,
la couche étant en `position:fixed`) :

1. **Réseau neuronal** — canvas calculé en direct dans la page (nœuds ambre
   qui dérivent, liens de proximité, points de données émeraude pulsants).
   Fonctionne partout, sans réseau, sans fichier.
2. **Vidéo 3D IA** — clip de 8 s généré sur Higgsfield (Seedance 1.5) à
   partir d'un composite assemblant les trois images de référence
   (`refs/`) : le portrait au centre, les deux visuels tech en hologrammes
   d'arrière-plan, tous textes et chiffres supprimés.
   Jouée en boucle, muette, à 42 % d'opacité sous un voile dégradé.

Source de la vidéo (CDN Higgsfield) :

```
https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20260730_005955_b7dfa171-e171-4ecd-8108-44f7dc4af7a8.mp4
```

Composite (image fixe, sert aussi de poster) :

```
https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20260730_005304_ae0b54f6-2254-48b0-a99f-b69de3098d1a.png
```

### Comment la vidéo est servie

`netlify.toml` déclare un **proxy** sur `/assets/clips/bg-tech.mp4`
(`status = 200`, `force = false`) : Netlify va chercher le clip chez
Higgsfield et le renvoie **en même origine**. Le navigateur du visiteur ne
contacte donc aucun serveur externe, et la vidéo joue dès le déploiement,
sans configuration.

Ordre des sources tenté par le site (le premier qui charge gagne) :

1. `assets/clips/bg-tech.webm` — variante VP9 si vous en produisez une ;
2. `assets/clips/bg-tech.mp4` — fichier local, sinon le proxy Netlify ;
3. l'URL CDN Higgsfield en dernier recours ;
4. sinon : le réseau neuronal canvas, seul, qui reste toujours animé.

### Auto-héberger la vidéo (recommandé à terme)

L'URL CDN peut expirer. Une commande, puis commit :

```bash
curl -L -o portfolio/assets/clips/bg-tech.mp4 \
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20260730_005955_b7dfa171-e171-4ecd-8108-44f7dc4af7a8.mp4"
```

Le fichier local est alors servi en priorité sur le proxy, sans toucher au
code. Compression conseillée au-delà de ~5 Mo :

```bash
ffmpeg -i bg-tech.mp4 -an -vf scale=1280:-2 -c:v libx264 -crf 28 \
  -preset slow -movflags +faststart bg-tech-web.mp4
# variante WebM, plus légère, servie en priorité :
ffmpeg -i bg-tech.mp4 -an -c:v libvpx-vp9 -b:v 700k bg-tech.webm
```

L'opacité de la couche vidéo est de **62 %** (`index.html`, événement
`canplay`) : nettement visible tout en préservant la lisibilité du texte.

## 2. Typographie

100 % tech, **auto-hébergée** dans `vendor/fonts.css` (woff2 en base64,
aucune dépendance à un CDN de polices) :

- **Chakra Petch** 400/600/700 — titres, corps de texte
- **JetBrains Mono** 400/500 — libellés, chiffres, étiquettes

## 3. Images de référence (`refs/`)

Les trois sources fournies par Estevao, conservées pour pouvoir
régénérer le composite : `estevao-suit.png`, `ref-vr.jpg`, `ref-agency.jpg`.
Elles ne sont pas nécessaires au site et sont exclues du paquet Netlify.

## 4. Autres fichiers

- `estevao-graded.jpg` — portrait étalonné (nuit + liseré ambre) affiché
  sur la face avant de la carte 3D du hero.
- `hero/og-frame.jpg` — image Open Graph 1200×630.

## Garantie « toujours animé »

La couche vidéo est conçue pour ne jamais s'arrêter. `index.html` installe :

- une **relance immédiate** sur les événements `pause`, `ended`, `stalled`
  et `waiting` — une pause système, une touche média ou un mode économie
  d'énergie ne peut pas figer le fond ;
- une **reprise** sur `visibilitychange` (retour d'onglet), `pageshow`
  (restauration depuis le cache de navigation), `focus` et `resume`
  (dégel de page, Page Lifecycle API) ;
- un **démarrage à la première interaction** (`pointerdown`, `touchstart`,
  `keydown`) si le navigateur a refusé l'autoplay ;
- un **chien de garde toutes les 3 s** qui vérifie que la couche est bien
  présente dans le document, visible et en progression. Il corrige trois
  pannes : élément retiré du DOM, flux figé (`paused=false` mais temps
  immobile), et échec de toutes les sources au chargement — dans ce dernier
  cas il retente jusqu'à 10 fois, donc la vidéo reprend d'elle-même dès que
  le réseau revient.

Le chien de garde ne travaille pas quand l'onglet est masqué (aucune
consommation inutile) et ne crée jamais de second élément vidéo.

Testé au navigateur : pause forcée, 5 pauses en rafale, onglet masqué puis
revenu, fin de flux, élément arraché du DOM, réseau coupé puis rétabli, et
un test d'endurance de 60 s avec perturbations — **aucun échantillon en
pause, un seul élément vidéo, 8 boucles observées**.

Seule exception volontaire : `prefers-reduced-motion: reduce`, où la vidéo
reste désactivée pour des raisons d'accessibilité (le site reste complet et
lisible).
