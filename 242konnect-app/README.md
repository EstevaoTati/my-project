# 242Konnect — mobile app

React Native (Expo) implementation of Sleek project `1kNSsCfTUFD`. A services
marketplace for Pointe-Noire: pick a category, browse verified professionals,
open a profile, book.

## Run it

```bash
cd 242konnect-app
npm install
npx expo start          # then scan the QR code with Expo Go
npx expo start --web    # or run it in a browser
```

No native build is required — everything used here works in Expo Go.

## How it maps to the design

| Design screen | File |
|---|---|
| Accueil | `src/screens/HomeScreen.tsx` |
| Résultats de recherche | `src/screens/SearchResultsScreen.tsx` |
| Profil professionnel | `src/screens/ProfessionalProfileScreen.tsx` |

`src/theme.ts` holds the design tokens verbatim from the export's `:root` block,
so a re-export from Sleek only needs that one file updated rather than every
screen.

`src/icons.ts` is **generated** from the design's Iconify SVGs (Solar + MDI) and
rendered through `react-native-svg`. Don't hand-edit it, and don't swap in a
different icon set — `@expo/vector-icons` carries neither family, and mismatched
icons are the fastest way to lose design fidelity.

Search and profile live inside the Accueil tab's stack rather than as their own
tabs, so the bottom bar stays put while browsing and "back" returns to where the
search started. The profile screen is the one exception: it hides the tab bar,
because its "Réserver maintenant" bar owns the bottom of the viewport and two
stacked bars bury the primary action.

## Data

`src/data/index.ts` is static content lifted from the three designed screens.
The design specifies four professionals, so the app ships four — category
filtering genuinely returns one result for "Ménage" rather than padding the list
with invented people. Swapping in an API means replacing that one module; the
screens read through its selectors and don't care where the data comes from.

The sort/filter pills are wired up rather than decorative. A filter row that
doesn't filter reads as a broken app, not as a prototype.

## Not built yet

- Missions, Messages and Profil are stubs. They're in the design's tab bar but
  were never designed as screens, so they say "bientôt disponible" instead of
  being dead taps.
- The "+" action in the tab bar (post a job) has no flow behind it.
- Booking, messaging, auth and payments are all absent — this is the front end
  against static data.
- Favourites live in component state and reset on unmount.
- The second portfolio tile is still the design tool's grey placeholder
  (`assets/images/landscape.png`) and needs a real photo.

## Re-syncing from Sleek

The Sleek skill is installed at `.claude/skills/sleek-design-mobile-apps/`.
Fetch component code with `?inlineIcons=true` so the HTML comes back with
self-contained SVGs, then regenerate `src/icons.ts` from them. See
`.claude/skills/sleek-design-mobile-apps/VENDORED.md` — note that reaching the
Sleek API needs `sleek.design` allowed by the session's egress policy, which is
currently blocked.
