import type { IconName } from '../icons';

/**
 * The service catalogue, transcribed from the cahier des charges §4.3.
 *
 * These are the categories and métiers the spec actually lists — not the
 * shorter set that was invented while building from the design export. The spec
 * targets "plus de 100 catégories de services" long term (§1.9); this is the
 * documented starting set, and the shape supports adding more without touching
 * any screen (§4.5).
 *
 * Icons come from the design's Solar/MDI set. Categories deliberately carry no
 * per-category colour: the charte is black, grey and yellow, so categories are
 * distinguished by icon and label, with yellow reserved for the selected state.
 *
 * Price ranges are indicative hourly figures in FCFA for Pointe-Noire, shown so
 * a client has an order of magnitude before contacting anyone. They are not
 * quotes — real pricing is set by each prestataire (§5.4, negotiation).
 */

export type CategoryId =
  | 'construction'
  | 'electricite'
  | 'plomberie'
  | 'nettoyage'
  | 'transport'
  | 'automobile'
  | 'informatique'
  | 'beaute'
  | 'sante'
  | 'education'
  | 'maison'
  | 'droit'
  | 'evenementiel'
  | 'agriculture'
  | 'autres';

export type Category = {
  id: CategoryId;
  label: string;
  icon: IconName;
  blurb: string;
};

export const categories: Category[] = [
  { id: 'construction', label: 'Construction & Bâtiment', icon: 'solar:home-2-bold',
    blurb: 'Gros œuvre, finitions et second œuvre.' },
  { id: 'electricite', label: 'Électricité', icon: 'solar:bolt-bold-duotone',
    blurb: 'Installation, dépannage, solaire et sécurité.' },
  { id: 'plomberie', label: 'Plomberie', icon: 'solar:waterdrops-bold-duotone',
    blurb: 'Sanitaire, fuites, canalisations et chauffe-eau.' },
  { id: 'nettoyage', label: 'Nettoyage & Hygiène', icon: '242k:sparkles',
    blurb: 'Entretien, désinfection et espaces verts.' },
  { id: 'transport', label: 'Transport & Livraison', icon: '242k:truck',
    blurb: 'Livraison, chauffeur, déménagement et coursier.' },
  { id: 'automobile', label: 'Automobile', icon: 'mdi:wrench',
    blurb: 'Mécanique, carrosserie et dépannage.' },
  { id: 'informatique', label: 'Informatique & Numérique', icon: 'solar:monitor-smartphone-bold-duotone',
    blurb: 'Développement, réparation, réseau et design.' },
  { id: 'beaute', label: 'Beauté & Bien-être', icon: '242k:scissors',
    blurb: 'Coiffure, esthétique et soins.' },
  { id: 'sante', label: 'Santé & Assistance', icon: '242k:health-cross',
    blurb: 'Soins à domicile et accompagnement.' },
  { id: 'education', label: 'Éducation', icon: '242k:book',
    blurb: 'Cours, formation, traduction et coaching.' },
  { id: 'maison', label: 'Maison & Services domestiques', icon: 'solar:home-smile-bold-duotone',
    blurb: 'Ménage, cuisine, garde et couture.' },
  { id: 'droit', label: 'Droit & Conseil', icon: '242k:briefcase',
    blurb: 'Juridique, comptable et conseil.' },
  { id: 'evenementiel', label: 'Événementiel', icon: '242k:camera',
    blurb: 'Photo, son, décoration et traiteur.' },
  { id: 'agriculture', label: 'Agriculture', icon: '242k:leaf',
    blurb: 'Culture, élevage, irrigation et paysage.' },
  { id: 'autres', label: 'Autres services', icon: 'solar:tuning-square-2-bold',
    blurb: 'Serrurerie, soudure, climatisation, forage.' },
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

const t = (
  id: string,
  label: string,
  category: CategoryId,
  minRate: number,
  maxRate: number,
  description: string
): Trade => ({ id, label, category, minRate, maxRate, description });

export const trades: Trade[] = [
  // Construction & Bâtiment
  t('macon', 'Maçon', 'construction', 8000, 18000, 'Fondations, murs, chapes et enduits.'),
  t('coffreur', 'Coffreur', 'construction', 9000, 18000, 'Coffrage de dalles, poteaux et poutres avant coulage.'),
  t('ferrailleur', 'Ferrailleur', 'construction', 9000, 18000, "Façonnage et pose des armatures d'acier du béton armé."),
  t('charpentier', 'Charpentier', 'construction', 10000, 20000, 'Charpente, ossature bois et toiture.'),
  t('carreleur', 'Carreleur', 'construction', 9000, 18000, 'Pose de carrelage sol et mur, faïence et plinthes.'),
  t('peintre', 'Peintre', 'construction', 7000, 15000, 'Peinture intérieure et extérieure, enduits décoratifs.'),
  t('platrier', 'Plâtrier', 'construction', 8000, 16000, 'Cloisons, faux plafonds et enduits de plâtre.'),
  t('etancheur', 'Étancheur', 'construction', 10000, 22000, "Étanchéité des toitures et terrasses contre les infiltrations."),
  t('facadier', 'Façadier', 'construction', 9000, 20000, 'Ravalement, crépi et traitement des façades.'),
  t('chef-chantier', 'Chef de chantier', 'construction', 15000, 35000, "Coordination des équipes, planning et suivi d'exécution."),

  // Électricité
  t('electricien-batiment', 'Électricien bâtiment', 'electricite', 10000, 20000, 'Prises, éclairage, tableaux et mise aux normes.'),
  t('electricien-industriel', 'Électricien industriel', 'electricite', 15000, 30000, 'Armoires, moteurs et installations industrielles.'),
  t('installateur-solaire', 'Installateur solaire', 'electricite', 18000, 40000, 'Panneaux, batteries et onduleurs pour pallier les coupures.'),
  t('groupe-electrogene', 'Installateur groupe électrogène', 'electricite', 15000, 30000, "Pose, entretien et inverseurs de source."),
  t('videosurveillance', 'Installateur vidéosurveillance', 'electricite', 15000, 30000, 'Caméras et accès à distance depuis le téléphone.'),
  t('alarme', 'Installateur alarme', 'electricite', 12000, 28000, 'Alarmes intrusion, sirènes et détecteurs.'),
  t('domotique', 'Domotique', 'electricite', 18000, 40000, 'Pilotage de l’éclairage, des accès et de la clim.'),

  // Plomberie
  t('plombier', 'Plombier', 'plomberie', 10000, 20000, 'Installation et réparation de canalisations et robinetterie.'),
  t('debouchage', 'Débouchage', 'plomberie', 8000, 15000, 'Éviers, douches, WC et canalisations extérieures.'),
  t('installation-sanitaire', 'Installation sanitaire', 'plomberie', 12000, 25000, 'Pose de WC, lavabos, douches et baignoires.'),
  t('chauffe-eau', 'Chauffe-eau', 'plomberie', 12000, 25000, 'Pose, remplacement et détartrage.'),
  t('reparation-fuite', 'Réparation fuite', 'plomberie', 8000, 18000, 'Recherche et réparation de fuites, en urgence si besoin.'),
  t('canalisation', 'Canalisation', 'plomberie', 10000, 22000, 'Pose et remplacement de réseaux d’évacuation.'),

  // Nettoyage & Hygiène
  t('nettoyage-maison', 'Nettoyage maison', 'nettoyage', 6000, 12000, 'Entretien du domicile : sols, cuisine, sanitaires.'),
  t('nettoyage-bureau', 'Nettoyage bureau', 'nettoyage', 8000, 16000, 'Entretien de bureaux et locaux professionnels.'),
  t('nettoyage-industriel', 'Nettoyage industriel', 'nettoyage', 12000, 28000, 'Sites industriels, entrepôts et machines.'),
  t('desinfection', 'Désinfection', 'nettoyage', 10000, 22000, 'Traitement désinfectant des locaux.'),
  t('lavage-vitres', 'Lavage de vitres', 'nettoyage', 7000, 14000, 'Vitres, baies vitrées et vérandas, y compris en hauteur.'),
  t('espaces-verts', 'Entretien espaces verts', 'nettoyage', 7000, 15000, 'Tonte, taille et entretien des extérieurs.'),
  t('collecte-dechets', 'Collecte des déchets', 'nettoyage', 8000, 18000, 'Enlèvement et évacuation des déchets.'),
  t('recyclage', 'Recyclage', 'nettoyage', 8000, 18000, 'Tri et valorisation des déchets recyclables.'),
  t('desinsectisation', 'Désinsectisation', 'nettoyage', 10000, 20000, 'Traitement contre insectes et nuisibles.'),
  t('deratisation', 'Dératisation', 'nettoyage', 10000, 20000, 'Traitement et prévention contre les rongeurs.'),

  // Transport & Livraison
  t('livreur', 'Livreur', 'transport', 5000, 12000, 'Livraison de colis et courses en ville.'),
  t('chauffeur-prive', 'Chauffeur privé', 'transport', 10000, 25000, 'Mise à disposition à l’heure ou à la journée.'),
  t('taxi', 'Taxi', 'transport', 5000, 15000, 'Course en ville et transferts.'),
  t('demenagement', 'Déménagement', 'transport', 15000, 40000, 'Transport de meubles avec manutention.'),
  t('transport-marchandises', 'Transport de marchandises', 'transport', 15000, 45000, 'Acheminement de marchandises et matériaux.'),
  t('transport-scolaire', 'Transport scolaire', 'transport', 8000, 20000, 'Ramassage et dépose des élèves.'),
  t('coursier', 'Coursier', 'transport', 5000, 12000, 'Plis, documents et petits colis, à moto.'),
  t('livraison-express', 'Livraison express', 'transport', 8000, 18000, 'Livraison prioritaire dans la journée.'),

  // Automobile
  t('mecanicien', 'Mécanicien', 'automobile', 10000, 25000, 'Révision, freins, embrayage et diagnostic.'),
  t('electricien-auto', 'Électricien automobile', 'automobile', 10000, 22000, 'Batterie, alternateur, démarreur et faisceaux.'),
  t('carrossier', 'Carrossier', 'automobile', 12000, 28000, 'Débosselage et redressage de carrosserie.'),
  t('peintre-auto', 'Peintre automobile', 'automobile', 12000, 30000, 'Peinture et raccords de teinte.'),
  t('depannage-auto', 'Dépannage', 'automobile', 15000, 30000, 'Intervention sur place et remorquage.'),
  t('lavage-auto', 'Lavage automobile', 'automobile', 4000, 10000, 'Lavage intérieur et extérieur, polissage.'),
  t('vulcanisateur', 'Vulcanisateur', 'automobile', 3000, 8000, 'Réparation de pneus et crevaisons.'),

  // Informatique & Numérique
  t('dev-web', 'Développeur Web', 'informatique', 20000, 50000, 'Sites vitrines, boutiques en ligne et applications web.'),
  t('dev-mobile', 'Développeur Mobile', 'informatique', 25000, 60000, 'Applications Android et iOS.'),
  t('dev-ia', 'Développeur IA', 'informatique', 30000, 70000, 'Automatisations, agents et intégrations IA.'),
  t('reparation-ordinateur', 'Réparation ordinateur', 'informatique', 10000, 20000, 'Diagnostic, formatage et récupération de données.'),
  t('reparation-telephone', 'Réparation téléphone', 'informatique', 8000, 20000, 'Écrans, batteries et connecteurs de charge.'),
  t('reseau-informatique', 'Réseau informatique', 'informatique', 12000, 30000, 'Box, répéteurs, câblage et partage de connexion.'),
  t('cybersecurite', 'Cybersécurité', 'informatique', 25000, 60000, 'Audit, sécurisation des accès et des données.'),
  t('graphiste', 'Graphiste', 'informatique', 15000, 40000, 'Logos, identité visuelle et supports de communication.'),
  t('community-manager', 'Community Manager', 'informatique', 15000, 40000, 'Animation des réseaux sociaux et contenus.'),
  t('marketing-digital', 'Marketing Digital', 'informatique', 20000, 50000, 'Publicité en ligne, acquisition et campagnes.'),

  // Beauté & Bien-être
  t('coiffeur', 'Coiffeur', 'beaute', 5000, 15000, 'Coupe, entretien et soins capillaires.'),
  t('coiffeuse', 'Coiffeuse', 'beaute', 5000, 15000, 'Tresses, tissage, défrisage et coiffures d’événement.'),
  t('barbier', 'Barbier', 'beaute', 3000, 10000, 'Coupe, taille de barbe et rasage.'),
  t('maquilleuse', 'Maquilleuse', 'beaute', 10000, 30000, 'Maquillage mariage, cérémonie et séance photo.'),
  t('estheticienne', 'Esthéticienne', 'beaute', 8000, 20000, 'Soins du visage et du corps, épilation.'),
  t('manucure', 'Manucure', 'beaute', 5000, 12000, 'Soin des ongles et pose.'),
  t('pedicure', 'Pédicure', 'beaute', 5000, 12000, 'Soin des pieds et des ongles.'),
  t('massage', 'Massage', 'beaute', 10000, 25000, 'Massage relaxant et de récupération.'),
  t('spa', 'Spa', 'beaute', 15000, 35000, 'Prestations de bien-être et soins complets.'),

  // Santé & Assistance
  t('infirmier', 'Infirmier', 'sante', 10000, 25000, 'Soins à domicile, pansements et injections.'),
  t('aide-soignant', 'Aide-soignant', 'sante', 8000, 18000, 'Aide à la toilette, au lever et aux gestes du quotidien.'),
  t('garde-malade', 'Garde-malade', 'sante', 8000, 18000, 'Présence et surveillance auprès d’un patient.'),
  t('ambulance-privee', 'Ambulance privée', 'sante', 25000, 60000, 'Transport sanitaire.'),
  t('nutritionniste', 'Nutritionniste', 'sante', 15000, 35000, 'Bilan et suivi alimentaire.'),
  t('kinesitherapeute', 'Kinésithérapeute', 'sante', 15000, 35000, 'Rééducation et séances de kiné à domicile.'),

  // Éducation
  t('enseignant', 'Enseignant', 'education', 8000, 20000, 'Cours dans les matières du programme scolaire.'),
  t('repetiteur', 'Répétiteur', 'education', 5000, 15000, 'Soutien scolaire et aide aux devoirs.'),
  t('formateur', 'Formateur', 'education', 15000, 40000, 'Formation professionnelle et ateliers.'),
  t('traducteur', 'Traducteur', 'education', 10000, 30000, 'Traduction de documents et interprétariat.'),
  t('coach-professionnel', 'Coach professionnel', 'education', 20000, 50000, 'Accompagnement de carrière et de projet.'),
  t('coach-sportif', 'Coach sportif', 'education', 8000, 20000, 'Entraînement personnalisé à domicile.'),

  // Maison & Services domestiques
  t('femme-menage', 'Femme de ménage', 'maison', 5000, 12000, 'Entretien régulier du domicile.'),
  t('homme-menage', 'Homme de ménage', 'maison', 5000, 12000, 'Entretien régulier du domicile.'),
  t('baby-sitter', 'Baby-sitter', 'maison', 5000, 12000, 'Garde d’enfants à domicile.'),
  t('cuisinier', 'Cuisinier', 'maison', 10000, 25000, 'Préparation de repas à domicile.'),
  t('jardinier', 'Jardinier', 'maison', 6000, 15000, 'Entretien du jardin et des plantations.'),
  t('gardien', 'Gardien', 'maison', 6000, 15000, 'Surveillance de domicile ou de site.'),
  t('repassage', 'Repassage', 'maison', 5000, 10000, 'Repassage et pliage du linge.'),
  t('couture', 'Couture', 'maison', 5000, 20000, 'Retouches et confection sur mesure.'),

  // Droit & Conseil
  t('avocat', 'Avocat', 'droit', 30000, 80000, 'Conseil et représentation juridique.'),
  t('notaire', 'Notaire', 'droit', 30000, 80000, 'Actes authentiques et transactions.'),
  t('comptable', 'Comptable', 'droit', 20000, 50000, 'Tenue de comptes, bilans et déclarations.'),
  t('consultant-fiscal', 'Consultant fiscal', 'droit', 25000, 60000, 'Fiscalité, obligations et optimisation.'),
  t('consultant-rh', 'Consultant RH', 'droit', 25000, 60000, 'Recrutement, contrats et gestion du personnel.'),
  t('conseiller-juridique', 'Conseiller juridique', 'droit', 20000, 50000, 'Conseil sur contrats et démarches.'),

  // Événementiel
  t('photographe', 'Photographe', 'evenementiel', 20000, 60000, 'Reportage photo et retouche.'),
  t('videaste', 'Vidéaste', 'evenementiel', 25000, 70000, 'Captation vidéo et montage.'),
  t('dj', 'DJ', 'evenementiel', 20000, 50000, 'Animation musicale et sonorisation.'),
  t('animateur', 'Animateur', 'evenementiel', 15000, 40000, 'Animation et présentation d’événement.'),
  t('decoration', 'Décoration', 'evenementiel', 15000, 40000, 'Décoration de salle, bâches et arches.'),
  t('location-materiel', 'Location de matériel', 'evenementiel', 10000, 40000, 'Chaises, tables, bâches et sonorisation.'),
  t('traiteur', 'Traiteur', 'evenementiel', 15000, 40000, 'Cuisine pour mariages, baptêmes et réunions.'),

  // Agriculture
  t('agriculteur', 'Agriculteur', 'agriculture', 6000, 15000, 'Travaux de culture et de récolte.'),
  t('eleveur', 'Éleveur', 'agriculture', 6000, 15000, 'Conduite et soin du cheptel.'),
  t('irrigation', 'Irrigation', 'agriculture', 10000, 25000, 'Réseaux d’arrosage et pompage.'),
  t('tractoriste', 'Tractoriste', 'agriculture', 15000, 35000, 'Labour et travaux mécanisés.'),
  t('jardinage', 'Jardinage', 'agriculture', 6000, 15000, 'Plantation et entretien.'),
  t('paysagiste', 'Paysagiste', 'agriculture', 12000, 30000, 'Conception et aménagement d’extérieurs.'),

  // Autres services
  t('serrurier', 'Serrurier', 'autres', 8000, 20000, 'Ouverture, remplacement et blindage de serrures.'),
  t('vitrier', 'Vitrier', 'autres', 10000, 25000, 'Pose et remplacement de vitrages.'),
  t('soudeur', 'Soudeur', 'autres', 10000, 22000, 'Portails, grilles et réparations en soudure.'),
  t('menuisier-alu', 'Menuisier aluminium', 'autres', 12000, 28000, 'Fenêtres, portes et vérandas en aluminium.'),
  t('menuisier-bois', 'Menuisier bois', 'autres', 10000, 22000, 'Portes, placards et meubles sur mesure.'),
  t('climatisation', 'Climatisation', 'autres', 15000, 35000, 'Pose, entretien et recharge de climatiseurs.'),
  t('refrigeration', 'Réfrigération', 'autres', 15000, 30000, 'Chambres froides et vitrines réfrigérées.'),
  t('piscine', 'Piscine', 'autres', 15000, 40000, 'Construction, entretien et traitement de l’eau.'),
  t('forage', 'Forage', 'autres', 20000, 60000, 'Forage, pompes et château d’eau.'),
  t('energie-renouvelable', 'Énergie renouvelable', 'autres', 20000, 50000, 'Solutions solaires et stockage d’énergie.'),
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

/** Matches free text against trade names, descriptions and their category. */
export function searchTrades(query: string): Trade[] {
  const q = query.trim().toLowerCase();
  if (!q) return trades;
  return trades.filter((t) => {
    const cat = getCategory(t.category)?.label ?? '';
    return `${t.label} ${t.description} ${cat}`.toLowerCase().includes(q);
  });
}
