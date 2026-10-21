/**
 * Where 242Konnect operates, and how to write a phone number there.
 *
 * The founder's correction is specific on both counts: the phone field must not
 * be limited to the Republic of the Congo — "l'utilisateur doit pouvoir
 * sélectionner l'indicatif de son pays" — and the app must show that it is
 * available in the Congo and the United States, with Congolese cities on one
 * side and US states then cities on the other.
 *
 * So this file holds two things that are easy to conflate and shouldn't be: the
 * **dial code** a number is written with, and the **place** someone lives. They
 * are related but not the same — a Congolese number can belong to someone in
 * Houston — and the sign-up form asks for them separately.
 *
 * Only two countries are listed because only two are served. That is a product
 * decision, not an oversight, and the note says so.
 */

export type CountryCode = 'CG' | 'US';

export type Country = {
  code: CountryCode;
  /** Dial code without the plus. */
  dial: string;
  nameFr: string;
  nameEn: string;
  flag: string;
  /** How many digits the national number has, after any trunk prefix. */
  nationalDigits: number;
  /**
   * Some countries write the national number with a leading trunk digit that is
   * dropped when dialling internationally. Congolese mobiles are written
   * "06 123 45 67" locally and "+242 06 123 45 67" abroad — the zero is kept —
   * so this is false there. Left in because it is the first thing that breaks
   * when a third country is added.
   */
  dropsTrunkZero: boolean;
  /** Grouping for display, e.g. [2,3,2,2] renders "06 123 45 67". */
  grouping: number[];
  example: string;
};

export const COUNTRIES: Country[] = [
  {
    code: 'CG',
    dial: '242',
    nameFr: 'République du Congo',
    nameEn: 'Republic of the Congo',
    flag: '🇨🇬',
    nationalDigits: 9,
    dropsTrunkZero: false,
    grouping: [2, 3, 2, 2],
    example: '06 123 45 67',
  },
  {
    code: 'US',
    dial: '1',
    nameFr: 'États-Unis',
    nameEn: 'United States',
    flag: '🇺🇸',
    nationalDigits: 10,
    dropsTrunkZero: false,
    grouping: [3, 3, 4],
    example: '202 555 0142',
  },
];

export const DEFAULT_COUNTRY: CountryCode = 'CG';

/** Every served country code, for matching a number typed without its prefix. */
export const COUNTRY_CODES: CountryCode[] = COUNTRIES.map((c) => c.code);

export function countryFor(code: CountryCode): Country {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];
}

/** Digits only, capped at the country's length. */
export function normalizeNational(input: string, code: CountryCode): string {
  return input.replace(/\D/g, '').slice(0, countryFor(code).nationalDigits);
}

/** "061234567" -> "06 123 45 67", using the country's own grouping. */
export function formatNational(input: string, code: CountryCode): string {
  const digits = normalizeNational(input, code);
  const parts: string[] = [];
  let at = 0;
  for (const size of countryFor(code).grouping) {
    if (at >= digits.length) break;
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  if (at < digits.length) parts.push(digits.slice(at));
  return parts.join(' ');
}

export function isCompleteNumber(input: string, code: CountryCode): boolean {
  return normalizeNational(input, code).length === countryFor(code).nationalDigits;
}

/**
 * The canonical form stored on an account: dial code and national digits joined,
 * e.g. "242061234567". One string, unambiguous across countries, and directly
 * usable as an SMS destination.
 */
export function toE164(national: string, code: CountryCode): string {
  const country = countryFor(code);
  let digits = normalizeNational(national, code);
  if (country.dropsTrunkZero && digits.startsWith('0')) digits = digits.slice(1);
  return `${country.dial}${digits}`;
}

/** Splits a stored canonical number back into a country and a national part. */
export function fromE164(stored: string): { code: CountryCode; national: string } {
  const digits = stored.replace(/\D/g, '');
  // Longest dial code first, so "1" never shadows a longer code added later.
  const ordered = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const country of ordered) {
    if (digits.startsWith(country.dial)) {
      return { code: country.code, national: digits.slice(country.dial.length) };
    }
  }
  return { code: DEFAULT_COUNTRY, national: digits };
}

/** Display form for a stored number: "+242 06 123 45 67". */
export function formatStored(stored: string): string {
  const { code, national } = fromE164(stored);
  return `+${countryFor(code).dial} ${formatNational(national, code)}`;
}

/* ------------------------------------------------------------------ *
 * Places
 * ------------------------------------------------------------------ */

/**
 * Congolese cities: the twelve département capitals and the two
 * communes à statut particulier, which is the list people actually use when
 * naming where they live.
 */
export const CONGO_CITIES = [
  'Brazzaville',
  'Pointe-Noire',
  'Dolisie',
  'Nkayi',
  'Ouesso',
  'Owando',
  'Impfondo',
  'Madingou',
  'Gamboma',
  'Sibiti',
  'Djambala',
  'Ewo',
  'Kinkala',
  'Mossendjo',
];

/**
 * US states. The note asks for "les différents États, puis les informations de
 * ville/localisation correspondantes", so the state is chosen first and the
 * city is typed — enumerating every US city is not something to ship in a
 * bundle, and people know their own town.
 */
export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island',
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
];

/** Where someone is, in whichever shape their country uses. */
export type Location = {
  country: CountryCode;
  /** Congo: the city. United States: the city or town, typed. */
  city: string;
  /** United States only. */
  state?: string;
};

export function formatLocation(location: Location): string {
  const country = countryFor(location.country);
  if (location.country === 'US') {
    return [location.city, location.state, 'USA'].filter(Boolean).join(', ');
  }
  return `${location.city}, ${country.nameFr === 'République du Congo' ? 'Rép. du Congo' : country.nameFr}`;
}

export const DEFAULT_LOCATION: Location = { country: 'CG', city: 'Pointe-Noire' };

/** Every place the app can currently show work in, for the home city picker. */
export function knownLocations(): Location[] {
  return CONGO_CITIES.map((city) => ({ country: 'CG' as const, city }));
}
