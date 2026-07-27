import type { IconName } from '../icons';
import { colors } from '../theme';

/**
 * The trades catalogue.
 *
 * A marketplace is only useful if someone can find the specific thing they
 * need, so categories are broad buckets for browsing and `trades` are what
 * people actually search for — "débouchage", "climatisation", "coiffure". Each
 * trade carries a description and a realistic hourly range in FCFA, because a
 * price a customer can see before contacting anyone is the whole promise of
 * the product.
 *
 * Ranges are indicative figures for Pointe-Noire, not quotes. Real pricing has
 * to come from the professionals themselves once there is a backend.
 */

export type CategoryId =
  | 'plomberie'
  | 'electricite'
  | 'menage'
  | 'mecanique'
  | 'it'
  | 'construction'
  | 'froid'
  | 'beaute'
  | 'evenementiel'
  | 'transport';

export type Category = {
  id: CategoryId;
  label: string;
  icon: IconName;
  /** Accent used for the chip and for generated avatars in this category. */
  color: string;
  onColor: string;
  blurb: string;
};

export const categories: Category[] = [
  {
    id: 'plomberie',
    label: 'Plomberie',
    icon: 'solar:waterdrops-bold-duotone',
    color: colors.chart4,
    onColor: colors.white,
    blurb: 'Fuites, sanitaires, chauffe-eau et débouchage.',
  },
  {
    id: 'electricite',
    label: 'Électricité',
    icon: 'solar:bolt-bold-duotone',
    color: colors.accent,
    onColor: colors.accentForeground,
    blurb: 'Installation, dépannage, tableaux et groupes électrogènes.',
  },
  {
    id: 'menage',
    label: 'Ménage',
    icon: 'solar:home-smile-bold-duotone',
    color: colors.primary,
    onColor: colors.primaryForeground,
    blurb: 'Entretien régulier, grand nettoyage, repassage.',
  },
  {
    id: 'mecanique',
    label: 'Mécanique',
    icon: 'mdi:wrench',
    color: colors.chart3,
    onColor: colors.white,
    blurb: 'Auto, moto, dépannage sur place et diagnostic.',
  },
  {
    id: 'it',
    label: 'IT & Tech',
    icon: 'solar:monitor-smartphone-bold-duotone',
    color: colors.chart5,
    onColor: colors.white,
    blurb: 'Ordinateurs, téléphones, réseau et sites web.',
  },
  {
    id: 'construction',
    label: 'Construction',
    icon: 'solar:home-2-bold',
    color: '#b45309',
    onColor: colors.white,
    blurb: 'Maçonnerie, peinture, carrelage, menuiserie.',
  },
  {
    id: 'froid',
    label: 'Froid & Clim',
    icon: 'solar:waterdrops-bold-duotone',
    color: '#0891b2',
    onColor: colors.white,
    blurb: 'Climatisation, réfrigération, entretien et recharge.',
  },
  {
    id: 'beaute',
    label: 'Beauté',
    icon: 'solar:heart-bold',
    color: '#db2777',
    onColor: colors.white,
    blurb: 'Coiffure, esthétique et soins à domicile.',
  },
  {
    id: 'evenementiel',
    label: 'Événementiel',
    icon: 'solar:star-bold',
    color: '#7c3aed',
    onColor: colors.white,
    blurb: 'Traiteur, sonorisation, décoration, photo.',
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: 'solar:map-point-bold',
    color: '#0f766e',
    onColor: colors.white,
    blurb: 'Déménagement, livraison et chauffeur.',
  },
];

export type Trade = {
  id: string;
  label: string;
  category: CategoryId;
  description: string;
  /** Indicative hourly range in FCFA. */
  minRate: number;
  maxRate: number;
};

export const trades: Trade[] = [
  // Plomberie
  { id: 'plombier', label: 'Plombier', category: 'plomberie', minRate: 10000, maxRate: 20000,
    description: "Installation et réparation de canalisations, robinetterie et sanitaires. Intervention d'urgence en cas de fuite." },
  { id: 'debouchage', label: 'Débouchage', category: 'plomberie', minRate: 8000, maxRate: 15000,
    description: "Débouchage d'éviers, douches, WC et canalisations extérieures avec furet ou pompe haute pression." },
  { id: 'chauffe-eau', label: 'Chauffe-eau', category: 'plomberie', minRate: 12000, maxRate: 25000,
    description: 'Pose, remplacement et détartrage de chauffe-eau électriques ou à gaz.' },
  { id: 'forage', label: 'Forage & pompe', category: 'plomberie', minRate: 15000, maxRate: 35000,
    description: "Installation et entretien de pompes, surpresseurs et réservoirs d'eau." },

  // Électricité
  { id: 'electricien', label: 'Électricien', category: 'electricite', minRate: 10000, maxRate: 20000,
    description: 'Installation de prises, interrupteurs, éclairage et mise aux normes du tableau électrique.' },
  { id: 'groupe-electrogene', label: 'Groupe électrogène', category: 'electricite', minRate: 15000, maxRate: 30000,
    description: "Installation, entretien et réparation de groupes électrogènes et d'inverseurs de source." },
  { id: 'solaire', label: 'Énergie solaire', category: 'electricite', minRate: 18000, maxRate: 40000,
    description: 'Pose de panneaux solaires, batteries et onduleurs pour pallier les coupures.' },
  { id: 'domotique', label: 'Vidéosurveillance', category: 'electricite', minRate: 15000, maxRate: 30000,
    description: 'Installation de caméras, alarmes et interphones, avec accès depuis le téléphone.' },

  // Ménage
  { id: 'menage-regulier', label: 'Ménage régulier', category: 'menage', minRate: 6000, maxRate: 12000,
    description: 'Entretien hebdomadaire ou quotidien du domicile : sols, cuisine, sanitaires, poussière.' },
  { id: 'grand-nettoyage', label: 'Grand nettoyage', category: 'menage', minRate: 10000, maxRate: 20000,
    description: "Nettoyage en profondeur avant emménagement, après travaux ou en fin de bail." },
  { id: 'repassage', label: 'Repassage', category: 'menage', minRate: 5000, maxRate: 10000,
    description: 'Repassage et pliage du linge à domicile, au panier ou à l’heure.' },
  { id: 'vitres', label: 'Nettoyage de vitres', category: 'menage', minRate: 7000, maxRate: 14000,
    description: 'Vitres, baies vitrées et vérandas, y compris en hauteur avec perche.' },

  // Mécanique
  { id: 'mecanicien-auto', label: 'Mécanicien auto', category: 'mecanique', minRate: 10000, maxRate: 25000,
    description: 'Révision, freins, embrayage, distribution et diagnostic électronique.' },
  { id: 'depannage-route', label: 'Dépannage sur place', category: 'mecanique', minRate: 15000, maxRate: 30000,
    description: 'Intervention là où le véhicule est immobilisé : batterie, démarrage, crevaison.' },
  { id: 'carrosserie', label: 'Carrosserie', category: 'mecanique', minRate: 12000, maxRate: 28000,
    description: 'Débosselage, redressage et peinture de carrosserie.' },
  { id: 'moto', label: 'Mécanique moto', category: 'mecanique', minRate: 6000, maxRate: 15000,
    description: 'Entretien et réparation de motos et tricycles, très utilisés en ville.' },

  // IT & Tech
  { id: 'depannage-info', label: 'Dépannage informatique', category: 'it', minRate: 10000, maxRate: 20000,
    description: 'Réparation, formatage, sauvegarde de données et suppression de virus.' },
  { id: 'reparation-tel', label: 'Réparation téléphone', category: 'it', minRate: 8000, maxRate: 20000,
    description: "Écrans, batteries, connecteurs de charge et déblocage." },
  { id: 'reseau', label: 'Réseau & WiFi', category: 'it', minRate: 12000, maxRate: 25000,
    description: 'Installation de box, répéteurs, câblage réseau et partage de connexion.' },
  { id: 'web', label: 'Site web', category: 'it', minRate: 20000, maxRate: 50000,
    description: 'Création de sites vitrines, boutiques en ligne et pages pour réseaux sociaux.' },

  // Construction
  { id: 'macon', label: 'Maçon', category: 'construction', minRate: 8000, maxRate: 18000,
    description: 'Fondations, murs, chapes, enduits et petites extensions.' },
  { id: 'peintre', label: 'Peintre', category: 'construction', minRate: 7000, maxRate: 15000,
    description: 'Peinture intérieure et extérieure, enduits décoratifs et reprises.' },
  { id: 'carreleur', label: 'Carreleur', category: 'construction', minRate: 9000, maxRate: 18000,
    description: 'Pose de carrelage sol et mur, faïence et plinthes.' },
  { id: 'menuisier', label: 'Menuisier', category: 'construction', minRate: 10000, maxRate: 22000,
    description: 'Portes, placards, meubles sur mesure et réparation de bois.' },
  { id: 'soudure', label: 'Soudure & métal', category: 'construction', minRate: 10000, maxRate: 22000,
    description: 'Portails, grilles, charpente métallique et réparations en soudure.' },

  // Froid & Clim
  { id: 'clim-install', label: 'Installation clim', category: 'froid', minRate: 15000, maxRate: 35000,
    description: 'Pose de split, mono ou multi, avec mise en service et test d’étanchéité.' },
  { id: 'clim-entretien', label: 'Entretien clim', category: 'froid', minRate: 8000, maxRate: 15000,
    description: 'Nettoyage des filtres, recharge de gaz et diagnostic de panne.' },
  { id: 'froid-commercial', label: 'Froid commercial', category: 'froid', minRate: 15000, maxRate: 30000,
    description: 'Chambres froides, vitrines réfrigérées et congélateurs professionnels.' },

  // Beauté
  { id: 'coiffure', label: 'Coiffure à domicile', category: 'beaute', minRate: 5000, maxRate: 15000,
    description: 'Coupe, tresses, tissage et soins capillaires chez vous.' },
  { id: 'esthetique', label: 'Esthétique', category: 'beaute', minRate: 6000, maxRate: 15000,
    description: 'Manucure, pédicure, pose d’ongles et soins du visage.' },
  { id: 'maquillage', label: 'Maquillage', category: 'beaute', minRate: 10000, maxRate: 30000,
    description: 'Maquillage mariage, cérémonie et séance photo.' },

  // Événementiel
  { id: 'traiteur', label: 'Traiteur', category: 'evenementiel', minRate: 15000, maxRate: 40000,
    description: 'Cuisine pour mariages, baptêmes et réunions, sur place ou livrée.' },
  { id: 'sono', label: 'Sonorisation & DJ', category: 'evenementiel', minRate: 20000, maxRate: 50000,
    description: 'Sono, éclairage et animation musicale pour tout type d’événement.' },
  { id: 'decoration', label: 'Décoration', category: 'evenementiel', minRate: 15000, maxRate: 40000,
    description: 'Décoration de salle, bâches, tables et arches florales.' },
  { id: 'photo', label: 'Photo & vidéo', category: 'evenementiel', minRate: 20000, maxRate: 60000,
    description: 'Reportage photo et vidéo, montage et livraison des fichiers.' },

  // Transport
  { id: 'demenagement', label: 'Déménagement', category: 'transport', minRate: 15000, maxRate: 40000,
    description: 'Transport de meubles et cartons, avec manutention et véhicule adapté.' },
  { id: 'livraison', label: 'Livraison', category: 'transport', minRate: 5000, maxRate: 15000,
    description: 'Livraison de colis et courses en ville, à moto ou en véhicule.' },
  { id: 'chauffeur', label: 'Chauffeur', category: 'transport', minRate: 10000, maxRate: 25000,
    description: 'Mise à disposition d’un chauffeur à l’heure ou à la journée.' },
];

export function getCategory(id: CategoryId): Category | undefined {
  return categories.find((c) => c.id === id);
}

export function getTrade(id: string): Trade | undefined {
  return trades.find((t) => t.id === id);
}

export function tradesInCategory(id: CategoryId): Trade[] {
  return trades.filter((t) => t.category === id);
}

/** Matches a free-text query against trade names, descriptions and category. */
export function searchTrades(query: string): Trade[] {
  const q = query.trim().toLowerCase();
  if (!q) return trades;
  return trades.filter((t) => {
    const cat = getCategory(t.category)?.label ?? '';
    return `${t.label} ${t.description} ${cat}`.toLowerCase().includes(q);
  });
}
