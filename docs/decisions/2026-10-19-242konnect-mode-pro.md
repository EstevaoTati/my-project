# 242Konnect — a distinct look for the Prestataire profile ("Mode Pro")

**Date:** 2026-10-19 · **Asked by:** founder ("que le compte des prestataires soit différent de celui des particuliers dans le style")

## Decision

When the active profile is Prestataire, the app switches to Mode Pro:

| | Particulier (Client) | Prestataire (Mode Pro) |
|---|---|---|
| Ground | light `#fafafa`, white cards | anthracite `#0e1014` / `#16181d` |
| Actions | black, yellow as accent | yellow, black type |
| Accueil header | "Bienvenue," | "Espace Pro" + PRO badge, trade, verification status, "Tableau de bord" button |
| Centre button | Publier une demande | Mon Espace Pro (wrench) |
| Profil | light | fully anthracite, PRO badge |
| Espace Prestataire | — | always anthracite, yellow figures |

Tokens live in `242konnect-app/src/proTheme.ts`; `useProMode()` reads
`account.activeProfile`.

## Why

- One account carries both profiles. Before this, switching profile changed one
  chip, so a provider could not tell which hat they were wearing.
- Two-sided marketplaces separate the roles visually: Uber Driver and Rider,
  Airbnb Host and Guest. Inverting the action colour (black → yellow) is the
  change people notice right away.
- It stays inside the brand guidelines: black, grey and yellow, plus the
  anthracite and metal grey already named for the opening screen.

## What deliberately did not change

- **The marketplace.** A prestataire keeps search, categories and booking, the
  same as a client. Removing them was a bug that has already been fixed once.
  Mode Pro changes the look, not the capabilities.
- **Sign-up screens.** They stay neutral, because the profile is chosen during
  sign-up itself.

## Verification

`tools/verify-pro-mode.js` (10 checks) covers:

- the anthracite tab bar and the PRO header;
- the centre button and the marketplace still being present;
- dashboard navigation;
- switching to Particulier and back.

The existing suites still pass:

- app walkthrough 136, prestataire 30, particulier 12, PIN log-in 18;
- marketplace 14, language 12, mobile 10, sign-up order 11;
- logo 11, PIN 11, insecure origin 7, e-mail OTP 5;
- paths 12, no-demo 14, CSP 18, i18n 601.
