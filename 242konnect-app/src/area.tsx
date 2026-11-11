/**
 * Where a client is browsing: always their own country, and optionally one
 * city in it.
 *
 * The country comes from the account, chosen at sign-up and verified with it.
 * It is not a setting: someone who signed up in the United States sees the
 * United States — its cities, its prestataires — and someone in the Congo sees
 * the Congo. Before this, the home screen was hard-wired to Congolese cities
 * and opened on Pointe-Noire for everybody, including the testers in Utah.
 *
 * The city only orders results: prestataires of the chosen city come first,
 * the rest of the country after them. Hiding the others would leave most
 * screens empty while the directory is young, and the neighbouring town is
 * often the right answer anyway.
 */
import { useMemo } from 'react';
import { useAuth } from './auth';
import { CONGO_CITIES, countryFor, type CountryCode } from './countries';
import { useI18n, type Language } from './i18n';
import { useStore } from './store';

export type Area = {
  country: CountryCode;
  /** Null: the whole country. */
  city: string | null;
};

/** "PROVO", "provo " and "Provo" are one city. */
export function sameCity(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** "Provo" for "PROVO" or "provo": people type their town in every case. */
export function tidyCity(city: string): string {
  const trimmed = city.trim().replace(/\s+/g, ' ');
  if (trimmed !== trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

export function countryName(code: CountryCode, language: Language): string {
  const country = countryFor(code);
  return language === 'en' ? country.nameEn : country.nameFr;
}

/** Short form for the end of a place name: "Provo, USA", "Brazzaville, Rép. du Congo". */
function countrySuffix(code: CountryCode, language: Language): string {
  if (code === 'US') return 'USA';
  return language === 'en' ? 'Rep. of the Congo' : 'Rép. du Congo';
}

export function areaLabel(area: Area, language: Language, state?: string): string {
  if (!area.city) return countryName(area.country, language);
  return [tidyCity(area.city), area.country === 'US' ? state : undefined, countrySuffix(area.country, language)]
    .filter(Boolean)
    .join(', ');
}

export type AreaOption = { city: string | null; label: string };

/**
 * The area this account browses, and the choices its picker offers.
 *
 * `knownCities` are the cities prestataires of this country are listed in, so
 * a country without a fixed list (the United States, where the town is typed)
 * still offers the places where there is someone to find.
 */
export function useArea(knownCities: string[] = []) {
  const { account } = useAuth();
  const { area: stored, setArea } = useStore();
  const { language } = useI18n();

  return useMemo(() => {
    const country: CountryCode = account?.location.country === 'US' ? 'US' : 'CG';
    const home = account?.location.city?.trim() || null;
    const base = country === 'CG' ? CONGO_CITIES : [];
    const cities: string[] = [];
    for (const c of [home, ...base, ...knownCities]) {
      if (c && c.trim() && !cities.some((x) => sameCity(x, c))) cities.push(tidyCity(c));
    }
    // A stored choice from another country (an account that moved, or the old
    // default of Pointe-Noire for everyone) does not apply: fall back to home.
    const chosen =
      stored === null ? null : stored && cities.some((c) => sameCity(c, stored)) ? tidyCity(stored) : home && tidyCity(home);
    const area: Area = { country, city: chosen ?? null };
    const state = country === 'US' && sameCity(area.city, home) ? account?.location.state : undefined;
    const options: AreaOption[] = [
      { city: null, label: areaLabel({ country, city: null }, language) },
      ...cities.map((city) => ({
        city,
        label: areaLabel({ country, city }, language, sameCity(city, home) ? account?.location.state : undefined),
      })),
    ];
    return { area, label: areaLabel(area, language, state), options, setArea, home };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.location.country, account?.location.city, account?.location.state, stored, language, knownCities.join('|')]);
}
