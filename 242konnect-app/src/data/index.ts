import type { ImageSourcePropType } from 'react-native';
import { getTrade, type CategoryId, type Trade } from './trades';

export * from './trades';

/**
 * The prestataires directory.
 *
 * The four people the Sleek design specifies keep their photos and copy. The
 * rest are demo records so that every category returns someone — a category
 * that opens onto an empty list reads as a broken app rather than a new one.
 *
 * They deliberately carry no photograph: inventing a face for a fictional
 * tradesperson, or reusing a real one, would misrepresent a person. They fall
 * back to an initials avatar in the charte's greyscale instead.
 *
 * All placeholder content. Real listings come from prestataires signing up and
 * being validated by 242Konnect (cahier §2.2), which needs the backend.
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
  /** Only the four prestataires drawn in the design carry a photo. */
  photo?: ImageSourcePropType;
  /** The "Prestataire vérifié" badge, awarded by 242Konnect (§7.6). */
  verified: boolean;
  /** Score 242K (§7.4), 0-100. Placeholder values until the backend computes it. */
  score: number;
  city: string;
  distanceKm: number;
  tags: string[];
  availability: string;
  availableNow: boolean;
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
  score: number,
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
  score,
  city: 'Pointe-Noire',
  distanceKm,
  tags,
  availability: availableNow ? "Disponible aujourd'hui" : 'Délai: 24h',
  availableNow,
});

export const professionals: Professional[] = [
  // --- The four from the design, with their photos and copy ---
  {
    ...P('jean-paul-k', 'Jean-Paul K.', 'plombier', 4.9, 124, 18000, 2.4, 94,
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
    ...P('david-l', 'David L.', 'plombier', 4.7, 63, 12000, 5.1, 71, ['Sanitaire', 'Tuyauterie'], false, false),
    photo: require('../../assets/images/OPHXsqIvD4F.jpeg'),
  },
  {
    ...P('marcel-b', 'Marcel B.', 'electricien-batiment', 4.9, 124, 15000, 3.2, 92, ['Installation', 'Dépannage'], true),
    photo: require('../../assets/images/OPHXsqIvD4F.jpeg'),
  },
  {
    ...P('sylvie-m', 'Sylvie M.', 'nettoyage-maison', 4.8, 89, 10000, 1.8, 88, ['Ménage', 'Repassage'], false),
    photo: require('../../assets/images/29VDvpIduPl.jpeg'),
  },

  // --- Demo records, no photographs ---
  P('prosper-n', 'Prosper N.', 'debouchage', 4.6, 41, 11000, 3.9, 79, ['Furet', 'Haute pression'], true),
  P('chancel-m', 'Chancel M.', 'chauffe-eau', 4.5, 28, 16000, 6.2, 74, ['Électrique', 'Gaz'], false),
  P('tresor-m', 'Trésor M.', 'reparation-fuite', 4.4, 19, 12000, 8.4, 68, ['Urgence', 'Détection'], true),

  P('alphonse-d', 'Alphonse D.', 'macon', 4.6, 54, 13000, 6.4, 77, ['Chape', 'Enduit'], true),
  P('benedicte-s', 'Bénédicte S.', 'peintre', 4.7, 47, 11000, 3.7, 81, ['Intérieur', 'Extérieur'], true),
  P('bienvenu-t', 'Bienvenu T.', 'carreleur', 4.5, 38, 13000, 5.9, 72, ['Sol', 'Faïence'], false),
  P('gustave-m', 'Gustave M.', 'charpentier', 4.6, 31, 15000, 7.8, 75, ['Toiture', 'Ossature'], false),
  P('brice-o', 'Brice O.', 'chef-chantier', 4.8, 26, 28000, 9.1, 86, ['Planning', 'Suivi'], false),

  P('fiston-k', 'Fiston K.', 'groupe-electrogene', 4.7, 52, 20000, 4.6, 83, ['Entretien', 'Inverseur'], true),
  P('espoir-b', 'Espoir B.', 'installateur-solaire', 4.8, 33, 28000, 7.1, 85, ['Panneaux', 'Batteries'], false),
  P('rodrigue-m', 'Rodrigue M.', 'videosurveillance', 4.5, 24, 19000, 5.3, 73, ['Caméras', 'Accès distant'], true),

  P('grace-b', 'Grâce B.', 'nettoyage-bureau', 4.9, 76, 14000, 2.1, 91, ['Bureaux', 'Locaux'], true),
  P('clarisse-b', 'Clarisse B.', 'lavage-vitres', 4.7, 31, 9000, 4.8, 80, ['Baies vitrées', 'Hauteur'], true),
  P('ferdinand-k', 'Ferdinand K.', 'deratisation', 4.5, 22, 15000, 6.7, 70, ['Traitement', 'Prévention'], false),

  P('junior-m', 'Junior M.', 'livreur', 4.7, 126, 8000, 1.4, 87, ['Moto', 'Express'], true),
  P('gaston-p', 'Gaston P.', 'chauffeur-prive', 4.8, 44, 15000, 3.0, 84, ['Journée', 'Aéroport'], true),
  P('emmanuel-t', 'Emmanuel T.', 'demenagement', 4.6, 39, 25000, 7.4, 76, ['Camion', 'Manutention'], false),

  P('armand-p', 'Armand P.', 'mecanicien', 4.8, 97, 18000, 4.2, 89, ['Diagnostic', 'Freins'], true),
  P('josue-k', 'Josué K.', 'depannage-auto', 4.6, 58, 22000, 6.9, 78, ['Batterie', 'Remorquage'], true),
  P('cedric-o', 'Cédric O.', 'carrossier', 4.5, 36, 20000, 7.7, 71, ['Débosselage', 'Peinture'], false),
  P('patrick-e', 'Patrick E.', 'vulcanisateur', 4.7, 64, 5000, 2.9, 80, ['Pneus', 'Crevaison'], true),

  P('gloire-m', 'Gloire M.', 'reparation-ordinateur', 4.8, 71, 15000, 3.1, 86, ['Virus', 'Données'], true),
  P('merveille-n', 'Merveille N.', 'reparation-telephone', 4.7, 88, 12000, 2.6, 85, ['Écran', 'Batterie'], true),
  P('hugues-m', 'Hugues M.', 'reseau-informatique', 4.6, 29, 18000, 5.5, 74, ['WiFi', 'Câblage'], false),
  P('naomie-t', 'Naomie T.', 'dev-web', 4.9, 22, 35000, 4.0, 88, ['Vitrine', 'Boutique'], false),
  P('steve-b', 'Steve B.', 'graphiste', 4.7, 35, 22000, 3.4, 79, ['Logo', 'Identité'], true),

  P('rachel-n', 'Rachel N.', 'coiffeuse', 4.9, 112, 9000, 1.6, 93, ['Tresses', 'Tissage'], true),
  P('laetitia-b', 'Laëtitia B.', 'estheticienne', 4.8, 74, 10000, 2.8, 87, ['Soins', 'Épilation'], true),
  P('sandra-m', 'Sandra M.', 'maquilleuse', 4.9, 49, 20000, 4.1, 89, ['Mariage', 'Photo'], false),
  P('nathan-k', 'Nathan K.', 'barbier', 4.7, 91, 4000, 1.9, 82, ['Coupe', 'Barbe'], true),

  P('esperance-l', 'Espérance L.', 'infirmier', 4.9, 43, 18000, 3.3, 90, ['Domicile', 'Pansements'], true),
  P('viviane-m', 'Viviane M.', 'garde-malade', 4.8, 28, 12000, 4.5, 84, ['Jour', 'Nuit'], false),

  P('samuel-n', 'Samuel N.', 'repetiteur', 4.8, 67, 8000, 2.2, 85, ['Maths', 'Français'], true),
  P('carine-b', 'Carine B.', 'traducteur', 4.7, 24, 20000, 5.0, 78, ['FR/EN', 'Documents'], false),

  P('adele-m', 'Adèle M.', 'femme-menage', 4.8, 82, 8000, 1.7, 88, ['Régulier', 'Ponctuel'], true),
  P('nadege-l', 'Nadège L.', 'repassage', 4.6, 44, 7000, 3.4, 76, ['À domicile', 'Au panier'], false),
  P('christelle-o', 'Christelle O.', 'baby-sitter', 4.9, 38, 7000, 2.5, 87, ['Soir', 'Week-end'], true),
  P('mireille-k', 'Mireille K.', 'cuisinier', 4.7, 33, 15000, 4.3, 81, ['Domicile', 'Événement'], false),

  P('gerard-m', 'Gérard M.', 'comptable', 4.8, 41, 30000, 5.8, 86, ['Bilan', 'Déclarations'], false),
  P('solange-n', 'Solange N.', 'conseiller-juridique', 4.7, 19, 30000, 6.2, 79, ['Contrats', 'Démarches'], false),

  P('yann-b', 'Yann B.', 'photographe', 4.9, 55, 40000, 3.6, 90, ['Reportage', 'Retouche'], true),
  P('kevin-m', 'Kévin M.', 'dj', 4.8, 63, 35000, 6.1, 85, ['Sono', 'Éclairage'], true),
  P('flore-k', 'Flore K.', 'decoration', 4.7, 41, 25000, 4.9, 80, ['Salle', 'Arche'], false),
  P('bertrand-l', 'Bertrand L.', 'traiteur', 4.7, 58, 28000, 5.7, 82, ['Mariage', 'Baptême'], false),

  P('honore-b', 'Honoré B.', 'paysagiste', 4.6, 27, 20000, 8.2, 74, ['Aménagement', 'Entretien'], false),
  P('modeste-n', 'Modeste N.', 'irrigation', 4.5, 18, 18000, 9.4, 70, ['Arrosage', 'Pompage'], false),

  P('serge-k', 'Serge K.', 'soudeur', 4.6, 35, 15000, 7.2, 75, ['Portail', 'Grilles'], false),
  P('ornella-k', 'Ornella K.', 'climatisation', 4.8, 66, 25000, 3.3, 88, ['Split', 'Entretien'], true),
  P('romeo-n', 'Roméo N.', 'refrigeration', 4.7, 40, 22000, 5.2, 81, ['Chambre froide', 'Vitrine'], true),
  P('divine-m', 'Divine M.', 'menuisier-bois', 4.8, 42, 16000, 4.4, 84, ['Placards', 'Sur mesure'], true),
  P('landry-t', 'Landry T.', 'serrurier', 4.6, 51, 12000, 2.7, 77, ['Ouverture', 'Blindage'], true),
  P('victoire-m', 'Victoire M.', 'forage', 4.5, 16, 35000, 11.2, 72, ['Pompe', 'Château d’eau'], false),
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
  return Math.round(amount).toLocaleString('fr-FR').replace(/ | /g, ' ');
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

/** Initials for prestataires with no photograph. */
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
 * not a rating sort. A feature slot is an editorial choice, and §4.6 describes
 * this section as an editorial/algorithmic mix rather than a leaderboard.
 */
export const topProfessionals = ['marcel-b', 'sylvie-m']
  .map((id) => getProfessional(id))
  .filter((p): p is Professional => p !== undefined);
