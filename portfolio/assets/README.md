# Assets — Landing page Estevao / Mwinda Group

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

### Auto-héberger la vidéo (recommandé)

L'URL CDN peut expirer, et certains hébergeurs à CSP stricte bloquent les
médias distants. Une seule commande, puis commit :

```bash
curl -L -o portfolio/assets/clips/bg-tech.mp4 \
  "https://d8j0ntlcm91z4.cloudfront.net/user_3G9osobYr0aAENArzSDrqEFJFgW/hf_20260730_005955_b7dfa171-e171-4ecd-8108-44f7dc4af7a8.mp4"
```

Le site détecte et préfère automatiquement `assets/clips/bg-tech.mp4`
lorsqu'il existe ; sinon il retombe sur le CDN, puis sur le réseau
neuronal seul. Compression conseillée si le fichier dépasse ~4 Mo :

```bash
ffmpeg -i bg-tech.mp4 -an -vf scale=1280:-2 -c:v libx264 -crf 27 \
  -preset slow -movflags +faststart bg-tech-web.mp4
```

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
