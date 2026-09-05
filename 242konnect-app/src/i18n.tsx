import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { en } from './locales/en';

/**
 * French and English, as the correction note asks for.
 *
 * **The French string is the key.** `t('Créer un compte')` returns the English
 * when the language is English and the French otherwise. The alternative —
 * inventing `signup.cta.create` and a French table to go with it — means naming
 * about a hundred and eighty strings, and every name is a chance to point two
 * screens at the same key by mistake or to leave one pointing at nothing.
 *
 * Three things fall out of this that are worth having:
 *
 * - A missing translation renders the French, not `signup.cta.create`. A French
 *   sentence on an English screen is a blemish; a visible key is a bug on
 *   display in front of a customer.
 * - The source stays readable. `t('Mot de passe oublié ?')` says what it puts on
 *   screen, so a screen can be reviewed without a second file open beside it.
 * - There is no French table to drift out of step with the code.
 *
 * The cost is real and worth naming: editing French copy orphans its
 * translation, silently falling back to the new French. `npm run i18n:check`
 * lists every string in the code with no English, which is how that gets caught.
 *
 * Placeholders are `{named}` rather than positional, because English and French
 * do not order a sentence the same way and a translator must be free to move
 * them.
 */

/**
 * Marks a string for translation without translating it yet.
 *
 * Tables defined at module level — status labels, FAQ sections, menu rows —
 * cannot call `t()` where they are written, because there is no language until
 * a component renders. They are translated at the point of use with
 * `t(row.label)`, which works but is invisible to any tool scanning for
 * strings: the extractor sees a variable, not a sentence.
 *
 * Wrapping the literal in `T(...)` fixes that. It returns the string untouched
 * and exists only so the string can be found and checked for a translation.
 */
export const T = (french: string): string => french;

export type Language = 'fr' | 'en';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

const STORAGE_KEY = '242k.language';

/** Values substituted into a string's `{placeholders}`. */
export type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in vars ? String(vars[name]) : whole
  );
}

type I18nState = {
  language: Language;
  setLanguage: (next: Language) => void;
  /** `french` is both the key and the French output. */
  t: (french: string, vars?: Vars) => string;
};

const I18nContext = createContext<I18nState | null>(null);

/** The device's language when it is one we speak, else French. */
function deviceLanguage(): Language {
  try {
    return getLocales()[0]?.languageCode?.toLowerCase() === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(deviceLanguage);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'fr' || stored === 'en') setLanguageState(stored);
      })
      .catch(() => {});
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback<I18nState['t']>(
    (french, vars) => interpolate(language === 'en' ? (en[french] ?? french) : french, vars),
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/** Shorthand for the common case of only needing the function. */
export function useT(): I18nState['t'] {
  return useI18n().t;
}
