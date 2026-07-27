import type { ImageSourcePropType } from 'react-native';
import { getTrade, type CategoryId, type Trade } from './trades';

export * from './trades';

/**
 * The professionals directory.
 *
 * The four people the Sleek design specifies keep their photos and copy. The
 * rest are demo records added so that every trade in the catalogue actually
 * returns someone — a category that opens onto an empty list makes the app
 * look broken rather than new.
 *
 * They deliberately have no photographs: inventing a face for a fictional
 * tradesperson, or reusing a real one, would misrepresent a person. They fall
 * back to an initials avatar tinted with their category colour instead.
 *
 * All of it is placeholder content. Real listings come from professionals
 * signing up, which needs a backend.
 */

export type Professional = {
  id: string;
  name: string;
  /** Points into the trades catalogue; the category is derived from it. */
  tradeId: string;
  rating: number;
  reviewCount: number;
  /** Hourly rate in FCFA. */
  hourlyRate: number;
  /** Only the four professionals drawn in the design carry a photo. */
  photo?: ImageSourcePropType;
  verified: boolean;
  city: string;
  distanceKm: number;
  tags: string[];
  availability: string;
  availableNow: boolean;
  /** Longer profile copy; the design only wrote one of these. */
  profile?: {
    headline: string;
    missions: number;
    about: string;
    skills: string[];
    portfolio: ImageSourcePropType[];
  };
};

const P = (
  id: string,
  name: string,
  tradeId: string,
  rating: number,
  reviewCount: number,
  hourlyRate: number,
  distanceKm: number,
  tags: string[],
  availableNow: boolean,
  verified = true
): Professional => ({
  id,
  name,
  tradeId,
  rating,
  reviewCount,
  hourlyRate,
  verified,
  city: 'Pointe-Noire',
  distanceKm,
  tags,
  availability: availableNow ? "Disponible aujourd'hui" : 'Délai: 24h',
  availableNow,
});

export const professionals: Professional[] = [
  // --- The four from the design, with their photos and copy ---
  {
    ...P('jean-paul-k', 'Jean-Paul K.', 'plombier', 4.9, 124, 18000, 2.4,
      ['Installation', 'Réparation', 'Urgence 24h'], true),
    photo: require('../../assets/images/lIUj5S4tFtC.jpeg'),
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
    ...P('david-l', 'David L.', 'plombier', 4.7, 63, 12000, 5.1, ['Sanitaire', 'Tuyauterie'], false, false),
    photo: require('../../assets/images/OPHXsqIvD4F.jpeg'),
  },
  {
    ...P('marcel-b', 'Marcel B.', 'electricien', 4.9, 124, 15000, 3.2, ['Installation', 'Dépannage'], true),
    photo: require('../../assets/images/OPHXsqIvD4F.jpeg'),
  },
  {
    ...P('sylvie-m', 'Sylvie M.', 'menage-regulier', 4.8, 89, 10000, 1.8, ['Ménage', 'Repassage'], false),
    photo: require('../../assets/images/29VDvpIduPl.jpeg'),
  },

  // --- Demo records, no photographs ---
  P('prosper-n', 'Prosper N.', 'debouchage', 4.6, 41, 11000, 3.9, ['Furet', 'Haute pression'], true),
  P('chancel-m', 'Chancel M.', 'chauffe-eau', 4.5, 28, 16000, 6.2, ['Électrique', 'Gaz'], false),
  P('tresor-m', 'Trésor M.', 'forage', 4.4, 19, 22000, 8.4, ['Pompes', 'Surpresseurs'], false),

  P('fiston-k', 'Fiston K.', 'groupe-electrogene', 4.7, 52, 20000, 4.6, ['Entretien', 'Inverseur'], true),
  P('espoir-b', 'Espoir B.', 'solaire', 4.8, 33, 28000, 7.1, ['Panneaux', 'Batteries'], false),
  P('rodrigue-m', 'Rodrigue M.', 'domotique', 4.5, 24, 19000, 5.3, ['Caméras', 'Alarme'], true),

  P('grace-b', 'Grâce B.', 'grand-nettoyage', 4.9, 76, 14000, 2.1, ['Après travaux', 'Fin de bail'], true),
  P('nadege-l', 'Nadège L.', 'repassage', 4.6, 44, 7000, 3.4, ['À domicile', 'Au panier'], false),
  P('clarisse-b', 'Clarisse B.', 'vitres', 4.7, 31, 9000, 4.8, ['Baies vitrées', 'Hauteur'], true),

  P('armand-p', 'Armand P.', 'mecanicien-auto', 4.8, 97, 18000, 4.2, ['Diagnostic', 'Freins'], true),
  P('josue-k', 'Josué K.', 'depannage-route', 4.6, 58, 22000, 6.9, ['Batterie', 'Crevaison'], true),
  P('cedric-o', 'Cédric O.', 'carrosserie', 4.5, 36, 20000, 7.7, ['Débosselage', 'Peinture'], false),
  P('patrick-e', 'Patrick E.', 'moto', 4.7, 64, 9000, 2.9, ['Tricycle', 'Entretien'], true),

  P('gloire-m', 'Gloire M.', 'depannage-info', 4.8, 71, 15000, 3.1, ['Virus', 'Données'], true),
  P('merveille-n', 'Merveille N.', 'reparation-tel', 4.7, 88, 12000, 2.6, ['Écran', 'Batterie'], true),
  P('hugues-m', 'Hugues M.', 'reseau', 4.6, 29, 18000, 5.5, ['WiFi', 'Câblage'], false),
  P('naomie-t', 'Naomie T.', 'web', 4.9, 22, 35000, 4.0, ['Vitrine', 'Boutique'], false),

  P('alphonse-d', 'Alphonse D.', 'macon', 4.6, 54, 13000, 6.4, ['Chape', 'Enduit'], true),
  P('benedicte-s', 'Bénédicte S.', 'peintre', 4.7, 47, 11000, 3.7, ['Intérieur', 'Extérieur'], true),
  P('bienvenu-t', 'Bienvenu T.', 'carreleur', 4.5, 38, 13000, 5.9, ['Sol', 'Faïence'], false),
  P('divine-m', 'Divine M.', 'menuisier', 4.8, 42, 16000, 4.4, ['Placards', 'Sur mesure'], true),
  P('serge-k', 'Serge K.', 'soudure', 4.6, 35, 15000, 7.2, ['Portail', 'Grilles'], false),

  P('ornella-k', 'Ornella K.', 'clim-install', 4.8, 66, 25000, 3.3, ['Split', 'Multi'], true),
  P('romeo-n', 'Roméo N.', 'clim-entretien', 4.7, 81, 11000, 2.2, ['Recharge', 'Filtres'], true),
  P('sarah-n', 'Sarah N.', 'froid-commercial', 4.6, 27, 22000, 8.1, ['Chambre froide', 'Vitrine'], false),

  P('rachel-n', 'Rachel N.', 'coiffure', 4.9, 112, 9000, 1.6, ['Tresses', 'Tissage'], true),
  P('laetitia-b', 'Laëtitia B.', 'esthetique', 4.8, 74, 10000, 2.8, ['Ongles', 'Soins'], true),
  P('sandra-m', 'Sandra M.', 'maquillage', 4.9, 49, 20000, 4.1, ['Mariage', 'Photo'], false),

  P('bertrand-l', 'Bertrand L.', 'traiteur', 4.7, 58, 28000, 5.7, ['Mariage', 'Baptême'], false),
  P('dj-kevin', 'Kévin M.', 'sono', 4.8, 63, 35000, 6.1, ['Sono', 'Éclairage'], true),
  P('flore-k', 'Flore K.', 'decoration', 4.7, 41, 25000, 4.9, ['Salle', 'Arche'], false),
  P('yann-b', 'Yann B.', 'photo', 4.9, 55, 40000, 3.6, ['Reportage', 'Montage'], true),

  P('emmanuel-t', 'Emmanuel T.', 'demenagement', 4.6, 39, 25000, 7.4, ['Camion', 'Manutention'], false),
  P('junior-m', 'Junior M.', 'livraison', 4.7, 126, 8000, 1.4, ['Moto', 'Express'], true),
  P('gaston-p', 'Gaston P.', 'chauffeur', 4.8, 44, 15000, 3.0, ['Journée', 'Aéroport'], true),
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

/** Full figure with thin spaces, for totals and receipts where precision matters. */
export function formatFcfaFull(amount: number): string {
  return amount.toLocaleString('fr-FR').replace(/ | /g, ' ');
}

export function getProfessional(id: string): Professional | undefined {
  return professionals.find((p) => p.id === id);
}

export function professionalTrade(pro: Professional): Trade | undefined {
  return getTrade(pro.tradeId);
}

export function professionalCategory(pro: Professional): CategoryId | undefined {
  return getTrade(pro.tradeId)?.category;
}

/** Initials for professionals with no photograph. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function searchProfessionals(opts: {
  category?: CategoryId;
  tradeId?: string;
  query?: string;
}): Professional[] {
  const query = opts.query?.trim().toLowerCase();
  return professionals.filter((p) => {
    const trade = getTrade(p.tradeId);
    if (opts.tradeId && p.tradeId !== opts.tradeId) return false;
    if (opts.category && trade?.category !== opts.category) return false;
    if (!query) return true;
    const haystack = [p.name, trade?.label ?? '', trade?.description ?? '', ...p.tags]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

/**
 * "Top Professionnels" on the home screen — the curated pair the design shows,
 * not a rating sort. A feature slot is an editorial choice, not something a
 * rating tiebreak should decide.
 */
export const topProfessionals = ['marcel-b', 'sylvie-m']
  .map((id) => getProfessional(id))
  .filter((p): p is Professional => p !== undefined);
