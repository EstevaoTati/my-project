import type { ImageSourcePropType } from 'react-native';
import type { IconName } from '../icons';
import { colors } from '../theme';

/**
 * Content from the Sleek design (project 1kNSsCfTUFD).
 *
 * Every professional, rating, price and image below is taken from the three
 * designed screens. Nothing here is invented: the design specifies four
 * professionals, so the app ships four. That keeps category filtering honest —
 * "Ménage" really does return one result — rather than padding the list with
 * fictional people to make the UI look busier than the data is.
 *
 * This is still static content. Swapping it for an API means replacing this
 * module; the screens read from the exported selectors and don't care.
 */

export type CategoryId = 'menage' | 'plomberie' | 'electricite' | 'mecanique' | 'it';

export type Category = {
  id: CategoryId;
  label: string;
  icon: IconName;
  /** Accent colour, matching the per-category tint in the design. */
  color: string;
  /** Foreground used when the chip is active and filled with `color`. */
  onColor: string;
};

export const categories: Category[] = [
  {
    id: 'menage',
    label: 'Ménage',
    icon: 'solar:home-smile-bold-duotone',
    color: colors.primary,
    onColor: colors.primaryForeground,
  },
  {
    id: 'plomberie',
    label: 'Plomberie',
    icon: 'solar:waterdrops-bold-duotone',
    color: colors.chart4,
    onColor: colors.white,
  },
  {
    id: 'electricite',
    label: 'Électricité',
    icon: 'solar:bolt-bold-duotone',
    color: colors.accent,
    onColor: colors.accentForeground,
  },
  {
    id: 'mecanique',
    label: 'Mécanique',
    icon: 'mdi:wrench',
    color: colors.chart3,
    onColor: colors.white,
  },
  {
    id: 'it',
    label: 'IT & Tech',
    icon: 'solar:monitor-smartphone-bold-duotone',
    color: colors.chart5,
    onColor: colors.white,
  },
];

export type Professional = {
  id: string;
  name: string;
  /** Short trade line, e.g. "Électricien Qualifié". */
  trade: string;
  category: CategoryId;
  rating: number;
  reviewCount: number;
  /** Hourly rate in FCFA. Displayed as "18k FCFA/h". */
  hourlyRate: number;
  photo: ImageSourcePropType;
  verified: boolean;
  city: string;
  distanceKm: number;
  /** Service tags shown as pills on the results card. */
  tags: string[];
  /** Short availability line, e.g. "Disponible aujourd'hui". */
  availability: string;
  /** Whether availability reads as a positive (green) or neutral signal. */
  availableNow: boolean;
  /** Present when the design gives this professional a full profile screen. */
  profile?: {
    headline: string;
    missions: number;
    about: string;
    skills: string[];
    portfolio: ImageSourcePropType[];
  };
};

export const professionals: Professional[] = [
  {
    id: 'jean-paul-k',
    name: 'Jean-Paul K.',
    trade: 'Plombier Certifié',
    category: 'plomberie',
    rating: 4.9,
    reviewCount: 124,
    hourlyRate: 18000,
    photo: require('../../assets/images/lIUj5S4tFtC.jpeg'),
    verified: true,
    city: 'Pointe-Noire',
    distanceKm: 2.4,
    tags: ['Installation', 'Réparation', 'Urgence 24h'],
    availability: "Disponible aujourd'hui",
    availableNow: true,
    profile: {
      headline: "Plombier Certifié • 12 ans d'expérience",
      missions: 412,
      about:
        "Spécialiste de l'installation et de la maintenance sanitaire. J'interviens rapidement pour tout type de dépannage, de la fuite d'eau à la rénovation complète de votre salle de bain. Travail soigné et garanti.",
      skills: ['Tuyauterie PVC/Cuivre', 'Installation Chauffe-eau', 'Débouchage', 'Rénovation'],
      portfolio: [
        require('../../assets/images/5qt7Yb6rfyX.jpeg'),
        // Placeholder that shipped with the design — needs a real second photo.
        require('../../assets/images/landscape.png'),
      ],
    },
  },
  {
    id: 'david-l',
    name: 'David L.',
    trade: 'Plombier',
    category: 'plomberie',
    rating: 4.7,
    reviewCount: 63,
    hourlyRate: 12000,
    photo: require('../../assets/images/OPHXsqIvD4F.jpeg'),
    verified: false,
    city: 'Pointe-Noire',
    distanceKm: 5.1,
    tags: ['Sanitaire', 'Tuyauterie'],
    availability: 'Délai: 24h',
    availableNow: false,
  },
  {
    id: 'marcel-b',
    name: 'Marcel B.',
    trade: 'Électricien Qualifié',
    category: 'electricite',
    rating: 4.9,
    reviewCount: 124,
    hourlyRate: 15000,
    photo: require('../../assets/images/OPHXsqIvD4F.jpeg'),
    verified: true,
    city: 'Pointe-Noire',
    distanceKm: 3.2,
    tags: ['Installation', 'Dépannage'],
    availability: "Disponible aujourd'hui",
    availableNow: true,
  },
  {
    id: 'sylvie-m',
    name: 'Sylvie M.',
    trade: 'Service de Ménage',
    category: 'menage',
    rating: 4.8,
    reviewCount: 89,
    hourlyRate: 10000,
    photo: require('../../assets/images/29VDvpIduPl.jpeg'),
    verified: true,
    city: 'Pointe-Noire',
    distanceKm: 1.8,
    tags: ['Ménage', 'Repassage'],
    availability: 'Délai: 24h',
    availableNow: false,
  },
];

export const promo = {
  badge: '242Konnect',
  title: 'Chaque problème est un besoin de compétence.',
  subtitle: 'Just One Click.',
  image: require('../../assets/images/YJEtDQIira8.jpeg'),
};

/** "18k" — the design abbreviates thousands rather than showing full figures. */
export function formatFcfa(amount: number): string {
  return amount >= 1000 ? `${Math.round(amount / 1000)}k` : String(amount);
}

export function getProfessional(id: string): Professional | undefined {
  return professionals.find((p) => p.id === id);
}

export function getCategory(id: CategoryId): Category | undefined {
  return categories.find((c) => c.id === id);
}

/**
 * Filters by category and/or free-text query. The query matches name, trade and
 * tags, which is what a user typing "plomb" or "urgence" would expect to hit.
 */
export function searchProfessionals(opts: {
  category?: CategoryId;
  query?: string;
}): Professional[] {
  const query = opts.query?.trim().toLowerCase();
  return professionals.filter((p) => {
    if (opts.category && p.category !== opts.category) return false;
    if (!query) return true;
    const haystack = [p.name, p.trade, ...p.tags].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

/**
 * "Top Professionnels" on the home screen.
 *
 * This is the curated pair the design shows, not a rating sort. Sorting by
 * rating puts Jean-Paul K. here instead of Marcel B., which quietly contradicts
 * the design — and a home-screen feature slot is an editorial choice anyway,
 * not something a rating tiebreak should decide.
 */
export const topProfessionals = ['marcel-b', 'sylvie-m']
  .map((id) => getProfessional(id))
  .filter((p): p is Professional => p !== undefined);
