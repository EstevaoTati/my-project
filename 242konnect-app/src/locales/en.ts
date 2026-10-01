/**
 * English for the interface. French is the key; see `src/i18n.tsx` for why.
 *
 * Two conventions worth keeping to when adding lines here:
 *
 * - **Translate, don't transliterate.** "Prestataire" is a *provider* or a
 *   *professional* depending on where it sits, and "mission" is a *job* to an
 *   English speaker, not a mission. The French words for the platform's own
 *   ideas — 242Konnect, FCFA, Score 242K — stay as they are.
 * - **Keep the register.** The French copy is plain and direct rather than
 *   chatty, and the English should read the same way.
 *
 * `npm run i18n:check` lists every string in the code with no line here, which
 * is how an edited French sentence gets noticed before a customer sees it.
 */
export const en: Record<string, string> = {
  /* ---- Brand and shell ------------------------------------------------ */
  '242Konnect': '242Konnect',
  FCFA: 'FCFA',
  'FCFA/h': 'FCFA/h',
  '/h': '/h',
  Profil: 'Profile',
  Accueil: 'Home',
  Missions: 'Jobs',
  Messages: 'Messages',
  Catégories: 'Categories',
  Favoris: 'Favourites',
  Notifications: 'Notifications',
  Avis: 'Reviews',
  Portfolio: 'Portfolio',
  Galerie: 'Gallery',
  Documents: 'Documents',
  Clients: 'Clients',
  Revenus: 'Earnings',
  Performance: 'Performance',
  Abonnement: 'Subscription',
  Compétences: 'Skills',
  'Score 242K': 'Score 242K',
  'Top Professionnels': 'Top professionals',
  'Vérifié par 242K': 'Verified by 242K',
  'Expert Vérifié': 'Verified expert',

  /* ---- Welcome -------------------------------------------------------- */
  'Chaque problème est un besoin de compétence.': 'Every problem needs a skill.',
  'Trouvez un plombier, un électricien, une aide-ménagère ou un mécanicien vérifié à Pointe-Noire. Just One Click.':
    'Find a verified plumber, electrician, house cleaner or mechanic in Pointe-Noire. Just One Click.',
  'Découvrir 242Konnect': 'Discover 242Konnect',
  'Comment ça marche': 'How it works',
  'Nos valeurs': 'Our values',
  'Décrivez votre besoin': 'Describe what you need',
  '242Konnect met en relation les particuliers, les entreprises et les professionnels qualifiés, et centralise tout le parcours : recherche, réservation, paiement, suivi et évaluation.':
    '242Konnect connects individuals, businesses and qualified professionals, and brings the whole process together: search, booking, payment, tracking and reviews.',

  /* ---- Accounts and sign-in ------------------------------------------- */
  'Créer un compte': 'Create an account',
  'Créer un compte maintenant': 'Create an account now',
  'Créer mon compte': 'Create my account',
  "J'ai déjà un compte": 'I already have an account',
  "J'ai déjà un compte ·": 'I already have an account ·',
  "J'ai déjà un compte, se connecter": 'I already have an account, sign in',
  'Pas encore de compte ?': 'No account yet?',
  'Se connecter': 'Sign in',
  'Se déconnecter': 'Sign out',
  'Bon retour': 'Welcome back',
  'Bienvenue,': 'Welcome,',
  'Connectez-vous avec votre numéro ou votre adresse e-mail.':
    'Sign in with your phone number or your e-mail address.',
  'Vos identifiants': 'Your details',
  'Quel type de compte ?': 'What kind of account?',
  'Les informations demandées changent selon le type. Un seul compte suffit : vous pourrez activer les autres profils plus tard, avec le même identifiant.':
    'What we ask for depends on the type. One account is enough: you can activate the other profiles later with the same login.',
  'Profil actif': 'Active profile',
  Langue: 'Language',
  'Ce compte demande': 'This account needs',
  '+ activer': '+ activate',
  'Espace Prestataire': 'Provider space',

  /* ---- Identity fields ------------------------------------------------ */
  'Nom complet': 'Full name',
  'E-mail': 'E-mail',
  'Numéro de téléphone': 'Phone number',
  'Numéro de téléphone ou e-mail': 'Phone number or e-mail',
  'Indicatif du pays': 'Country code',
  Ville: 'City',
  'Votre ville': 'Your city',
  'Adresse complète': 'Full address',
  "Référence de l'adresse": 'Address landmark',
  'Quartier, avenue, numéro': 'Neighbourhood, street, number',
  'Les prestataires en ont besoin pour venir chez vous.':
    'Providers need this to reach you.',
  'Où intervenir ?': 'Where do you need help?',
  'vous@exemple.com': 'you@example.com',
  '06 123 45 67 ou vous@exemple.com': '06 123 45 67 or you@example.com',
  'Votre numéro est votre identifiant et ne peut pas être modifié ici.':
    'Your number is your login and cannot be changed here.',

  /* ---- Verification and passwords ------------------------------------- */
  Vérification: 'Verification',
  Vérifier: 'Verify',
  'Vérifier le code': 'Verify the code',
  'Code de vérification': 'Verification code',
  'Nous avons envoyé un code à {digits} chiffres à': 'We sent a {digits}-digit code to',
  'Votre mot de passe est correct. Ce code termine la connexion.':
    'Your password is correct. This code completes the sign-in.',
  'Consultez vos messages.': 'Check your messages.',
  'Consultez votre boîte e-mail, y compris les courriers indésirables.':
    'Check your inbox, including your spam folder.',
  "Le code expire dans {minutes} minutes et ne peut servir qu'une fois.":
    'The code expires in {minutes} minutes and can only be used once.',
  'Code reçu par e-mail': 'Code received by e-mail',
  'Recevoir le code de vérification par': 'Receive the verification code by',
  'Renvoyer le code': 'Resend the code',
  "Vous n'avez rien reçu ?": "Didn't receive anything?",
  'Continuer vers les informations': 'Continue to your details',
  'Créer votre mot de passe': 'Create your password',
  'Adresse vérifiée. Dernière étape : choisissez votre mot de passe.':
    'Address verified. Last step: choose your password.',
  'Confirmer le mot de passe': 'Confirm password',
  'Votre mot de passe': 'Your password',
  'Mot de passe oublié': 'Forgotten password',
  'Mot de passe oublié ?': 'Forgotten your password?',
  'Nouveau mot de passe': 'New password',
  'Modifier le mot de passe': 'Change password',
  'Mot de passe modifié': 'Password changed',
  'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.':
    'You can now sign in with your new password.',
  'Retourner à la connexion': 'Back to sign in',
  '. Saisissez-le, puis choisissez votre nouveau mot de passe.':
    '. Enter it, then choose your new password.',
  "Annuler l'inscription": 'Cancel sign-up',

  /* ---- Provider sign-up ----------------------------------------------- */
  'Votre métier': 'Your trade',
  Métier: 'Trade',
  'Choisir votre métier': 'Choose your trade',
  "Zone d'intervention": 'Service area',
  'Quartiers ou communes couverts': 'Neighbourhoods or districts covered',
  'Tarif horaire': 'Hourly rate',
  Tarif: 'Rate',
  'Date de naissance': 'Date of birth',
  'AAAA-MM-JJ': 'YYYY-MM-DD',
  Biographie: 'Biography',
  'À propos de vous': 'About you',
  'À propos': 'About',
  'Votre expérience et ce que vous proposez': 'Your experience and what you offer',
  'Employeurs, chantiers, années': 'Employers, sites, years',
  'Écoles, centres de formation': 'Schools, training centres',
  'CAP, BTS, certifications': 'Diplomas, certifications',
  'Pièces justificatives': 'Supporting documents',
  'Ajouter une pièce': 'Add a document',
  'Ajouter une pièce justificative': 'Add a supporting document',
  "Ces informations sont vérifiées par 242Konnect avant l'attribution du badge « Prestataire vérifié ».":
    'These are checked by 242Konnect before the "Verified provider" badge is awarded.',
  'Obligatoire pour un prestataire.': 'Required for a provider.',
  'Ajouter une photo de profil': 'Add a profile photo',
  'Choisir une photo': 'Choose a photo',
  'Prendre une photo': 'Take a photo',
  'Retirer la photo': 'Remove the photo',
  Caméra: 'Camera',
  'Modifier le profil': 'Edit profile',
  'Enregistrer le profil': 'Save profile',
  Enregistrer: 'Save',

  /* ---- Business ------------------------------------------------------- */

  /* ---- Search and browse ---------------------------------------------- */
  Rechercher: 'Search',
  'Rechercher un métier': 'Search for a trade',
  'Quel service recherchez-vous ?': 'What service are you looking for?',
  'De quel service avez-vous besoin ?': 'What service do you need?',
  'Toutes les catégories': 'All categories',
  'Tous les métiers': 'All trades',
  'Voir tous les métiers': 'See all trades',
  'Voir tout': 'See all',
  'Voir plus': 'See more',
  Tout: 'All',
  'Aucun métier trouvé': 'No trade found',
  'Aucun professionnel trouvé': 'No professional found',
  'Essayez un autre mot, par exemple « fuite » ou « clim ».':
    'Try another word, for example "leak" or "aircon".',
  "Ce professionnel n'est plus disponible.": 'This professional is no longer available.',
  'Voir tout le portfolio': 'See the full portfolio',
  'Fermer la galerie': 'Close the gallery',
  Partager: 'Share',

  /* ---- Booking -------------------------------------------------------- */
  Réserver: 'Book',
  'Réserver maintenant': 'Book now',
  'Choisissez un créneau': 'Choose a time',
  'Confirmer la réservation': 'Confirm booking',
  Confirmer: 'Confirm',
  'Aucune mission': 'No jobs',
  'Réservez un prestataire depuis son profil : la mission apparaîtra ici, avec le paiement.':
    'Book a provider from their profile and the job will appear here, with the payment.',
  'Publier une demande': 'Post a request',
  'Votre demande est en ligne': 'Your request is live',
  'Présentez votre besoin en quelques mots : le lieu, le problème et quand vous êtes disponible.':
    'Describe what you need in a few words: where, what the problem is, and when you are free.',
  "Simuler l'acceptation": 'Simulate acceptance',
  'En cours': 'In progress',
  'À payer': 'To pay',

  /* ---- Payment -------------------------------------------------------- */
  'Moyen de paiement': 'Payment method',
  'Confirmer le paiement': 'Confirm payment',
  'Annuler le paiement': 'Cancel payment',
  'Montant de la prestation': 'Service amount',
  'Numéro Mobile Money': 'Mobile Money number',
  'Le numéro du compte Mobile Money à débiter. Vous recevrez une demande de code PIN sur ce téléphone.':
    'The Mobile Money account to debit. You will get a PIN request on that phone.',
  "242Konnect conserve ce montant. Le prestataire ne sera payé qu'après votre validation de la prestation.":
    '242Konnect holds this amount. The provider is only paid once you approve the work.',
  "Tous les paiements passent par 242Konnect. Ne remettez jamais d'argent directement au prestataire, même en pourboire.":
    'All payments go through 242Konnect. Never hand money to a provider directly, not even as a tip.',
  'Télécharger le reçu': 'Download the receipt',
  Terminé: 'Done',
  'Signaler un problème': 'Report a problem',

  /* ---- Validation and settlement -------------------------------------- */
  Valider: 'Approve',
  'Valider et débloquer les fonds': 'Approve and release the funds',
  'Confirmer la validation': 'Confirm approval',
  'En validant, vous confirmez que la prestation a été réalisée. Les fonds sont alors débloqués et versés au prestataire.':
    'Approving confirms the work was done. The funds are then released and paid to the provider.',
  Répartition: 'Breakdown',
  'Commission 242Konnect': '242Konnect commission',
  'Versé au prestataire': 'Paid to the provider',
  'Versement standard': 'Standard payout',
  'Versement express': 'Express payout',
  'Mode de versement au prestataire': 'How the provider is paid',
  'Vos conditions': 'Your terms',
  "Vous ne recevez jamais d'argent directement du client. 242Konnect encaisse, conserve les fonds, puis vous verse après validation de la prestation.":
    'You never take money directly from the client. 242Konnect collects it, holds it, and pays you once the work is approved.',

  /* ---- Reviews -------------------------------------------------------- */
  'Laisser un avis': 'Leave a review',
  'Votre avis': 'Your review',
  'Votre note': 'Your rating',
  'Votre commentaire': 'Your comment',
  'Publier mon avis': 'Publish my review',
  "Comment s'est passée la prestation ?": 'How did the job go?',
  "Ajouter une photo à l'avis": 'Add a photo to the review',
  'Votre avis aide les autres clients à choisir, et le prestataire à progresser.':
    'Your review helps other clients choose, and helps the provider improve.',

  /* ---- Messaging ------------------------------------------------------ */
  'Aucune conversation': 'No conversations',
  'Écrivez votre message': 'Write your message',
  Envoyer: 'Send',
  "Ouvrez le profil d'un professionnel et appuyez sur le bouton message pour démarrer un échange.":
    "Open a professional's profile and tap the message button to start a conversation.",

  /* ---- Account and help ----------------------------------------------- */
  'Compte et données': 'Account and data',
  Sécurité: 'Security',
  'Préférences de notification': 'Notification preferences',
  'Questions fréquentes': 'Frequently asked questions',
  "Une question qui n'est pas ici ? Écrivez-nous depuis l'onglet Profil une fois le support en ligne.":
    'A question not covered here? Write to us from the Profile tab once support is live.',
  'Vos notifications de demande et de paiement apparaîtront ici.':
    'Your request and payment notifications will appear here.',
  'Votre activité': 'Your activity',
  'Services réalisés': 'Jobs completed',
  'Demandes et missions': 'Requests and jobs',
  'Votre formule actuelle': 'Your current plan',
  'Vérification du compte': 'Account verification',
  'En attente de vérification par 242Konnect': 'Awaiting verification by 242Konnect',
  'Aucune pièce transmise. Les documents accélèrent la vérification de votre compte.':
    'No documents submitted. Documents speed up verification of your account.',

  /* ---- Actions -------------------------------------------------------- */
  Annuler: 'Cancel',
  Retour: 'Back',
  Fermer: 'Close',
  Continuer: 'Continue',
  Retirer: 'Remove',
  "C'est noté": 'Got it',
  Bientôt: 'Soon',
  'Bientôt disponible': 'Coming soon',

  /* ---- Notes about what is not built yet ------------------------------ */
  "Démonstration : aucun argent n'a été débité. Les paiements réels nécessitent les comptes marchands MTN MoMo et Airtel Money côté serveur.":
    'Demo: no money was debited. Real payments need the MTN MoMo and Airtel Money merchant accounts on the server.',
  "Démonstration : aucun versement réel n'a lieu.": 'Demo: no real payout takes place.',
  'Démonstration : vos messages sont enregistrés sur cet appareil, mais personne ne les reçoit encore.':
    'Demo: your messages are saved on this device, but nobody receives them yet.',
  "Aucune mission reçue : il n'y a pas encore de clients sur cette version. Les revenus apparaîtront ici dès qu'une prestation sera validée.":
    'No jobs received: there are no clients on this version yet. Earnings will appear here once a job is approved.',
  'Les tarifs Premium et Business ne sont pas encore fixés, et la souscription demande le système de paiement des abonnements.':
    'Premium and Business pricing is not set yet, and subscribing needs the subscription payment system.',
  "Cet espace affiche la structure décrite au cahier des charges §2.2. Les sections qui dépendent d'autres utilisateurs — demandes, revenus, avis — restent vides tant qu'il n'y a pas de serveur : elles ne sont pas simulées.":
    'This space follows the structure in the specification §2.2. Sections that depend on other users — requests, earnings, reviews — stay empty while there is no server, rather than being simulated.',

  /* ---- Service catalogue: categories ---------------------------------- */
  'Construction & Bâtiment': 'Construction & Building',
  'Gros œuvre, finitions et second œuvre.': 'Structural work, finishing and fit-out.',
  'Électricité': 'Electrical',
  'Installation, dépannage, solaire et sécurité.': 'Installation, repairs, solar and security.',
  'Plomberie': 'Plumbing',
  'Sanitaire, fuites, canalisations et chauffe-eau.': 'Bathrooms, leaks, pipework and water heaters.',
  'Nettoyage & Hygiène': 'Cleaning & Hygiene',
  'Entretien, désinfection et espaces verts.': 'Cleaning, disinfection and grounds.',
  'Transport & Livraison': 'Transport & Delivery',
  'Livraison, chauffeur, déménagement et coursier.': 'Delivery, drivers, removals and couriers.',
  'Automobile': 'Automotive',
  'Mécanique, carrosserie et dépannage.': 'Mechanics, bodywork and breakdown.',
  'Informatique & Numérique': 'IT & Digital',
  'Développement, réparation, réseau et design.': 'Development, repairs, networking and design.',
  'Beauté & Bien-être': 'Beauty & Wellbeing',
  'Coiffure, esthétique et soins.': 'Hair, beauty and treatments.',
  'Santé & Assistance': 'Health & Care',
  'Soins à domicile et accompagnement.': 'Home care and support.',
  'Éducation': 'Education',
  'Cours, formation, traduction et coaching.': 'Lessons, training, translation and coaching.',
  'Maison & Services domestiques': 'Home & Domestic Services',
  'Ménage, cuisine, garde et couture.': 'Cleaning, cooking, childcare and sewing.',
  'Droit & Conseil': 'Legal & Advisory',
  'Juridique, comptable et conseil.': 'Legal, accounting and consulting.',
  'Événementiel': 'Events',
  'Photo, son, décoration et traiteur.': 'Photography, sound, decoration and catering.',
  'Agriculture': 'Agriculture',
  'Culture, élevage, irrigation et paysage.': 'Crops, livestock, irrigation and landscaping.',
  'Autres services': 'Other services',
  'Serrurerie, soudure, climatisation, forage.': 'Locksmithing, welding, air conditioning, drilling.',

  /* ---- Service catalogue: trades -------------------------------------- */
  'Maçon': 'Mason',
  'Fondations, murs, chapes et enduits.': 'Foundations, walls, screeds and rendering.',
  'Coffreur': 'Formworker',
  'Coffrage de dalles, poteaux et poutres avant coulage.': 'Formwork for slabs, columns and beams before pouring.',
  'Ferrailleur': 'Steel fixer',
  "Façonnage et pose des armatures d'acier du béton armé.": 'Shaping and fixing the steel reinforcement in concrete.',
  'Charpentier': 'Carpenter',
  'Charpente, ossature bois et toiture.': 'Roof frames, timber structures and roofing.',
  'Carreleur': 'Tiler',
  'Pose de carrelage sol et mur, faïence et plinthes.': 'Floor and wall tiling, splashbacks and skirting.',
  'Peintre': 'Painter',
  'Peinture intérieure et extérieure, enduits décoratifs.': 'Interior and exterior painting, decorative finishes.',
  'Plâtrier': 'Plasterer',
  'Cloisons, faux plafonds et enduits de plâtre.': 'Partitions, suspended ceilings and plasterwork.',
  'Étancheur': 'Waterproofer',
  'Étanchéité des toitures et terrasses contre les infiltrations.': 'Waterproofing roofs and terraces against leaks.',
  'Façadier': 'Facade specialist',
  'Ravalement, crépi et traitement des façades.': 'Rendering, roughcast and facade treatment.',
  'Chef de chantier': 'Site manager',
  "Coordination des équipes, planning et suivi d'exécution.": 'Coordinating crews, scheduling and overseeing the work.',
  'Électricien bâtiment': 'Building electrician',
  'Prises, éclairage, tableaux et mise aux normes.': 'Sockets, lighting, consumer units and bringing work up to code.',
  'Électricien industriel': 'Industrial electrician',
  'Armoires, moteurs et installations industrielles.': 'Control panels, motors and industrial installations.',
  'Installateur solaire': 'Solar installer',
  'Panneaux, batteries et onduleurs pour pallier les coupures.': 'Panels, batteries and inverters to cover power cuts.',
  'Installateur groupe électrogène': 'Generator installer',
  'Pose, entretien et inverseurs de source.': 'Installation, servicing and transfer switches.',
  'Installateur vidéosurveillance': 'CCTV installer',
  'Caméras et accès à distance depuis le téléphone.': 'Cameras and remote access from your phone.',
  'Installateur alarme': 'Alarm installer',
  'Alarmes intrusion, sirènes et détecteurs.': 'Intruder alarms, sirens and detectors.',
  'Domotique': 'Home automation',
  'Pilotage de l’éclairage, des accès et de la clim.': 'Control of lighting, access and air conditioning.',
  'Plombier': 'Plumber',
  'Installation et réparation de canalisations et robinetterie.': 'Installing and repairing pipework and taps.',
  'Débouchage': 'Drain unblocking',
  'Éviers, douches, WC et canalisations extérieures.': 'Sinks, showers, toilets and outside drains.',
  'Installation sanitaire': 'Bathroom fitting',
  'Pose de WC, lavabos, douches et baignoires.': 'Fitting toilets, basins, showers and baths.',
  'Chauffe-eau': 'Water heaters',
  'Pose, remplacement et détartrage.': 'Installation, replacement and descaling.',
  'Réparation fuite': 'Leak repair',
  'Recherche et réparation de fuites, en urgence si besoin.': 'Finding and fixing leaks, as an emergency if needed.',
  'Canalisation': 'Pipework',
  'Pose et remplacement de réseaux d’évacuation.': 'Installing and replacing waste pipework.',
  'Nettoyage maison': 'House cleaning',
  'Entretien du domicile : sols, cuisine, sanitaires.': 'Home cleaning: floors, kitchen, bathrooms.',
  'Nettoyage bureau': 'Office cleaning',
  'Entretien de bureaux et locaux professionnels.': 'Cleaning offices and business premises.',
  'Nettoyage industriel': 'Industrial cleaning',
  'Sites industriels, entrepôts et machines.': 'Industrial sites, warehouses and machinery.',
  'Désinfection': 'Disinfection',
  'Traitement désinfectant des locaux.': 'Disinfection treatment for premises.',
  'Lavage de vitres': 'Window cleaning',
  'Vitres, baies vitrées et vérandas, y compris en hauteur.': 'Windows, glazed doors and conservatories, including at height.',
  'Entretien espaces verts': 'Grounds maintenance',
  'Tonte, taille et entretien des extérieurs.': 'Mowing, pruning and outdoor upkeep.',
  'Collecte des déchets': 'Waste collection',
  'Enlèvement et évacuation des déchets.': 'Removing and disposing of waste.',
  'Recyclage': 'Recycling',
  'Tri et valorisation des déchets recyclables.': 'Sorting and recovering recyclable waste.',
  'Désinsectisation': 'Pest control',
  'Traitement contre insectes et nuisibles.': 'Treatment against insects and pests.',
  'Dératisation': 'Rodent control',
  'Traitement et prévention contre les rongeurs.': 'Treatment and prevention against rodents.',
  'Livreur': 'Delivery driver',
  'Livraison de colis et courses en ville.': 'Parcel delivery and errands around town.',
  'Chauffeur privé': 'Private driver',
  'Mise à disposition à l’heure ou à la journée.': 'Available by the hour or by the day.',
  'Taxi': 'Taxi',
  'Course en ville et transferts.': 'Trips around town and transfers.',
  'Déménagement': 'Removals',
  'Transport de meubles avec manutention.': 'Moving furniture, loading included.',
  'Transport de marchandises': 'Freight transport',
  'Acheminement de marchandises et matériaux.': 'Moving goods and materials.',
  'Transport scolaire': 'School transport',
  'Ramassage et dépose des élèves.': 'Picking up and dropping off pupils.',
  'Coursier': 'Courier',
  'Plis, documents et petits colis, à moto.': 'Letters, documents and small parcels, by motorbike.',
  'Livraison express': 'Express delivery',
  'Livraison prioritaire dans la journée.': 'Priority same-day delivery.',
  'Mécanicien': 'Mechanic',
  'Révision, freins, embrayage et diagnostic.': 'Servicing, brakes, clutch and diagnostics.',
  'Électricien automobile': 'Auto electrician',
  'Batterie, alternateur, démarreur et faisceaux.': 'Battery, alternator, starter motor and wiring.',
  'Carrossier': 'Panel beater',
  'Débosselage et redressage de carrosserie.': 'Dent removal and bodywork straightening.',
  'Peintre automobile': 'Vehicle painter',
  'Peinture et raccords de teinte.': 'Respraying and colour matching.',
  'Dépannage': 'Breakdown assistance',
  'Intervention sur place et remorquage.': 'Roadside assistance and towing.',
  'Lavage automobile': 'Car washing',
  'Lavage intérieur et extérieur, polissage.': 'Inside and out, plus polishing.',
  'Vulcanisateur': 'Tyre repair',
  'Réparation de pneus et crevaisons.': 'Repairing tyres and punctures.',
  'Développeur Web': 'Web developer',
  'Sites vitrines, boutiques en ligne et applications web.': 'Brochure sites, online shops and web apps.',
  'Développeur Mobile': 'Mobile developer',
  'Applications Android et iOS.': 'Android and iOS apps.',
  'Développeur IA': 'AI developer',
  'Automatisations, agents et intégrations IA.': 'Automations, agents and AI integrations.',
  'Réparation ordinateur': 'Computer repair',
  'Diagnostic, formatage et récupération de données.': 'Diagnostics, reinstalls and data recovery.',
  'Réparation téléphone': 'Phone repair',
  'Écrans, batteries et connecteurs de charge.': 'Screens, batteries and charging ports.',
  'Réseau informatique': 'Networking',
  'Box, répéteurs, câblage et partage de connexion.': 'Routers, repeaters, cabling and shared connections.',
  'Cybersécurité': 'Cybersecurity',
  'Audit, sécurisation des accès et des données.': 'Audits, securing access and data.',
  'Graphiste': 'Graphic designer',
  'Logos, identité visuelle et supports de communication.': 'Logos, visual identity and marketing material.',
  'Community Manager': 'Community manager',
  'Animation des réseaux sociaux et contenus.': 'Running social media and content.',
  'Marketing Digital': 'Digital marketing',
  'Publicité en ligne, acquisition et campagnes.': 'Online advertising, acquisition and campaigns.',
  'Coiffeur': 'Barber / hairdresser',
  'Coupe, entretien et soins capillaires.': 'Cuts, upkeep and hair treatments.',
  'Coiffeuse': 'Hairdresser',
  'Tresses, tissage, défrisage et coiffures d’événement.': 'Braids, weaves, relaxing and event styling.',
  'Barbier': 'Barber',
  'Coupe, taille de barbe et rasage.': 'Cuts, beard trims and shaves.',
  'Maquilleuse': 'Make-up artist',
  'Maquillage mariage, cérémonie et séance photo.': 'Wedding, ceremony and photoshoot make-up.',
  'Esthéticienne': 'Beautician',
  'Soins du visage et du corps, épilation.': 'Face and body treatments, waxing.',
  'Manucure': 'Manicure',
  'Soin des ongles et pose.': 'Nail care and extensions.',
  'Pédicure': 'Pedicure',
  'Soin des pieds et des ongles.': 'Foot and toenail care.',
  'Massage': 'Massage',
  'Massage relaxant et de récupération.': 'Relaxing and recovery massage.',
  'Spa': 'Spa',
  'Prestations de bien-être et soins complets.': 'Wellbeing services and full treatments.',
  'Infirmier': 'Nurse',
  'Soins à domicile, pansements et injections.': 'Home care, dressings and injections.',
  'Aide-soignant': 'Care assistant',
  'Aide à la toilette, au lever et aux gestes du quotidien.': 'Help with washing, getting up and daily tasks.',
  'Garde-malade': 'Patient sitter',
  'Présence et surveillance auprès d’un patient.': 'Companionship and watching over a patient.',
  'Ambulance privée': 'Private ambulance',
  'Transport sanitaire.': 'Medical transport.',
  'Nutritionniste': 'Nutritionist',
  'Bilan et suivi alimentaire.': 'Dietary assessment and follow-up.',
  'Kinésithérapeute': 'Physiotherapist',
  'Rééducation et séances de kiné à domicile.': 'Rehabilitation and physio sessions at home.',
  'Enseignant': 'Teacher',
  'Cours dans les matières du programme scolaire.': 'Lessons in school curriculum subjects.',
  'Répétiteur': 'Tutor',
  'Soutien scolaire et aide aux devoirs.': 'Extra lessons and homework help.',
  'Formateur': 'Trainer',
  'Formation professionnelle et ateliers.': 'Professional training and workshops.',
  'Traducteur': 'Translator',
  'Traduction de documents et interprétariat.': 'Document translation and interpreting.',
  'Coach professionnel': 'Career coach',
  'Accompagnement de carrière et de projet.': 'Career and project coaching.',
  'Coach sportif': 'Personal trainer',
  'Entraînement personnalisé à domicile.': 'Personal training at home.',
  'Femme de ménage': 'Housekeeper',
  'Entretien régulier du domicile.': 'Regular home cleaning.',
  'Homme de ménage': 'Housekeeper',
  'Baby-sitter': 'Babysitter',
  'Garde d’enfants à domicile.': 'Childcare at home.',
  'Cuisinier': 'Cook',
  'Préparation de repas à domicile.': 'Preparing meals at home.',
  'Jardinier': 'Gardener',
  'Entretien du jardin et des plantations.': 'Garden and planting upkeep.',
  'Gardien': 'Caretaker',
  'Surveillance de domicile ou de site.': 'Watching over a home or a site.',
  'Repassage': 'Ironing',
  'Repassage et pliage du linge.': 'Ironing and folding laundry.',
  'Couture': 'Sewing',
  'Retouches et confection sur mesure.': 'Alterations and made-to-measure.',
  'Avocat': 'Lawyer',
  'Conseil et représentation juridique.': 'Legal advice and representation.',
  'Notaire': 'Notary',
  'Actes authentiques et transactions.': 'Deeds and transactions.',
  'Comptable': 'Accountant',
  'Tenue de comptes, bilans et déclarations.': 'Bookkeeping, accounts and filings.',
  'Consultant fiscal': 'Tax consultant',
  'Fiscalité, obligations et optimisation.': 'Tax, obligations and planning.',
  'Consultant RH': 'HR consultant',
  'Recrutement, contrats et gestion du personnel.': 'Recruitment, contracts and staff management.',
  'Conseiller juridique': 'Legal adviser',
  'Conseil sur contrats et démarches.': 'Advice on contracts and procedures.',
  'Photographe': 'Photographer',
  'Reportage photo et retouche.': 'Photo coverage and retouching.',
  'Vidéaste': 'Videographer',
  'Captation vidéo et montage.': 'Filming and editing.',
  'DJ': 'DJ',
  'Animation musicale et sonorisation.': 'Music and sound for events.',
  'Animateur': 'Host',
  'Animation et présentation d’événement.': 'Hosting and presenting events.',
  'Décoration': 'Decoration',
  'Décoration de salle, bâches et arches.': 'Venue decoration, drapes and arches.',
  'Location de matériel': 'Equipment hire',
  'Chaises, tables, bâches et sonorisation.': 'Chairs, tables, marquees and sound systems.',
  'Traiteur': 'Caterer',
  'Cuisine pour mariages, baptêmes et réunions.': 'Catering for weddings, christenings and meetings.',
  'Agriculteur': 'Farmer',
  'Travaux de culture et de récolte.': 'Growing and harvesting.',
  'Éleveur': 'Livestock farmer',
  'Conduite et soin du cheptel.': 'Managing and caring for livestock.',
  'Irrigation': 'Irrigation',
  'Réseaux d’arrosage et pompage.': 'Watering systems and pumping.',
  'Tractoriste': 'Tractor operator',
  'Labour et travaux mécanisés.': 'Ploughing and mechanised work.',
  'Jardinage': 'Gardening',
  'Plantation et entretien.': 'Planting and upkeep.',
  'Paysagiste': 'Landscaper',
  'Conception et aménagement d’extérieurs.': 'Designing and laying out outdoor spaces.',
  'Serrurier': 'Locksmith',
  'Ouverture, remplacement et blindage de serrures.': 'Opening, replacing and reinforcing locks.',
  'Vitrier': 'Glazier',
  'Pose et remplacement de vitrages.': 'Fitting and replacing glazing.',
  'Soudeur': 'Welder',
  'Portails, grilles et réparations en soudure.': 'Gates, grilles and welding repairs.',
  'Menuisier aluminium': 'Aluminium fabricator',
  'Fenêtres, portes et vérandas en aluminium.': 'Aluminium windows, doors and conservatories.',
  'Menuisier bois': 'Joiner',
  'Portes, placards et meubles sur mesure.': 'Doors, fitted cupboards and bespoke furniture.',
  'Climatisation': 'Air conditioning',
  'Pose, entretien et recharge de climatiseurs.': 'Fitting, servicing and regassing air conditioners.',
  'Réfrigération': 'Refrigeration',
  'Chambres froides et vitrines réfrigérées.': 'Cold rooms and refrigerated display units.',
  'Piscine': 'Swimming pools',
  'Construction, entretien et traitement de l’eau.': 'Building, maintenance and water treatment.',
  'Forage': 'Borehole drilling',
  'Forage, pompes et château d’eau.': 'Boreholes, pumps and water towers.',
  'Énergie renouvelable': 'Renewable energy',
  'Solutions solaires et stockage d’énergie.': 'Solar solutions and energy storage.',

  /* ---- Welcome promises, steps, values and sample notices ------------- */
  'Prestataires vérifiés près de chez vous': 'Verified providers near you',
  'Une réponse le jour même, souvent en urgence': 'An answer the same day, often within the hour',
  'Tarifs annoncés à l’avance, en FCFA': 'Prices quoted upfront, in FCFA',
  'Choisissez un métier, indiquez la date, le lieu et votre budget.': 'Pick a trade, then give the date, the place and your budget.',
  'Recevez des propositions': 'Get offers',
  'Les prestataires qualifiés répondent, avec leur prix et leurs délais.': 'Qualified providers reply with their price and how soon they can come.',
  'Payez via 242Konnect': 'Pay through 242Konnect',
  "Le montant est conservé par la plateforme jusqu'à ce que vous validiez le travail.": 'The platform holds the money until you approve the work.',
  'Validez et évaluez': 'Approve and review',
  'Le prestataire est payé après votre validation, et vous notez la prestation.': 'The provider is paid once you approve, and you rate the job.',
  'Confiance': 'Trust',
  'Transparence, fiabilité et respect des engagements.': 'Transparency, reliability and keeping commitments.',
  'Compétence': 'Skill',
  'Des professionnels qualifiés, encouragés à l’excellence.': 'Qualified professionals, held to a high standard.',
  'Connexion': 'Connection',
  'Des mises en relation simples, rapides et efficaces.': 'Simple, fast and effective introductions.',
  'Vos données et vos paiements sont protégés.': 'Your data and your payments are protected.',
  'Simplicité': 'Simplicity',
  'Accéder à un service en quelques clics.': 'Reach a service in a few taps.',
  'Réactivité': 'Responsiveness',
  'Des réponses rapides et une communication fluide.': 'Quick replies and clear communication.',
  'Jean-Paul K. a accepté votre demande': 'Jean-Paul K. accepted your request',
  "Intervention prévue aujourd'hui à 14h.": 'Visit scheduled for today at 2pm.',
  'Nouveau professionnel vérifié': 'New verified professional',
  'Un électricien vérifié vient de rejoindre votre quartier.': 'A verified electrician has just joined your area.',
  'Notez votre dernière mission': 'Rate your last job',
  'Votre avis aide les autres clients à choisir.': 'Your review helps other clients choose.',

  /* ---- Code confidentiel (PIN) ---------------------------------------- */
  'Votre code confidentiel': 'Your PIN',
  'Changer votre code': 'Change your PIN',
  'Code confidentiel': 'PIN',
  'Code actuel': 'Current PIN',
  'Nouveau code': 'New PIN',
  'Confirmer le code': 'Confirm the PIN',
  'Les deux codes ne correspondent pas.': 'The two PINs do not match.',
  'Définir mon code': 'Set my PIN',
  'Changer mon code': 'Change my PIN',
  'Définir un code confidentiel': 'Set a PIN',
  'Changer mon code confidentiel': 'Change my PIN',
  'Valider le code confidentiel': 'Confirm the PIN',
  'Recevoir un code par e-mail': 'Receive a code by e-mail',
  'Code oublié ? Recevoir un code par e-mail': 'Forgot your PIN? Get a code by e-mail',
  'Envoi en cours…': 'Sending…',
  'Plus tard': 'Later',
  'Saisissez vos {digits} chiffres pour terminer la connexion.':
    'Enter your {digits} digits to finish signing in.',
  'Six chiffres pour vous reconnecter sans attendre un e-mail. Choisissez un code que vous seul connaissez, et ne le notez pas sur votre téléphone.':
    'Six digits to sign back in without waiting for an e-mail. Choose one only you know, and do not write it down on your phone.',
  "Le code n'est jamais enregistré sur cet appareil. Après cinq essais incorrects, il est bloqué quinze minutes.":
    'The PIN is never stored on this device. After five wrong tries it is locked for fifteen minutes.',
  'Plus tard — je recevrai un code par e-mail à chaque connexion.':
    'Later — I will get a code by e-mail at every sign-in.',
  'Ce code est nécessaire pour finaliser votre compte.':
    'This code is required to finish setting up your account.',
  "Votre profil est enregistré sur nos serveurs et vous suit d'un appareil à l'autre. Votre mot de passe, lui, reste sur ce téléphone : pour vous connecter ailleurs, utilisez la récupération de compte.":
    'Your profile is saved on our servers and follows you from one device to the next. Your password stays on this phone: to sign in elsewhere, use account recovery.',
  "Vous proposez vos services et vous pouvez aussi en réserver : l'accueil, la recherche et les réservations fonctionnent comme pour un particulier.":
    'You offer services and you can book them too: the home screen, search and bookings work exactly as they do for a particulier.',
  'Adresse e-mail': 'E-mail address',
  "Ce compte n'a pas encore pu être enregistré sur nos serveurs : il n'existe que sur cet appareil. Reconnectez-vous une fois en ligne pour le sauvegarder.":
    'This account could not be saved to our servers yet: it exists only on this device. Sign in again once you are online to save it.',

  /* ---- FAQ ------------------------------------------------------------ */
  'Utiliser 242Konnect':
    'Using 242Konnect',
  'Comment trouver un professionnel ?':
    'How do I find a professional?',
  "Choisissez une catégorie sur l'accueil, ou tapez votre besoin dans la recherche — par exemple « fuite », « clim » ou « tresses ». Vous verrez les professionnels disponibles avec leur note, leur distance et leur tarif horaire.":
    'Pick a category on the home screen, or type what you need into the search box — “leak”, “air conditioning” or “braids”, for example. You will see the professionals available, with their rating, their distance and their hourly rate.',
  'Que veut dire « Vérifié par 242K » ?':
    'What does “Verified by 242K” mean?',
  "Le badge signale un professionnel dont l'identité et le métier ont été contrôlés. Dans cette version de démonstration, le badge fait partie des données d'exemple : aucune vérification réelle n'a encore lieu.":
    'The badge marks a professional whose identity and trade have been checked. In this demonstration version the badge is part of the sample data: no real checking happens yet.',
  'Comment réserver ?':
    'How do I book?',
  "Ouvrez le profil du professionnel, appuyez sur « Réserver maintenant » et choisissez un créneau. La mission apparaît ensuite dans l'onglet Missions, où vous pouvez la payer ou l'annuler.":
    'Open the professional’s profile, tap “Book now” and choose a slot. The job then appears in the Jobs tab, where you can pay for it or cancel it.',
  'Puis-je annuler une mission ?':
    'Can I cancel a job?',
  "Oui : ouvrez l'onglet Missions et appuyez sur « Annuler ». Si vous aviez déjà payé, le montant vous est remboursé tant que la prestation n'a pas commencé. Prévenez aussi le prestataire par message, c'est plus correct.":
    'Yes: open the Jobs tab and tap “Cancel”. If you had already paid, you are refunded as long as the work has not started. Tell the provider by message too — it is the decent thing to do.',
  'Tarifs et paiement':
    'Prices and payment',
  'Comment sont fixés les prix ?':
    'How are prices set?',
  "Chaque professionnel affiche son tarif horaire en FCFA. La liste des métiers indique en plus une fourchette indicative pour vous donner un ordre de grandeur avant de contacter quelqu'un.":
    'Each professional shows their hourly rate in FCFA. The trade list also gives an indicative range, so you have an idea of the order of magnitude before contacting anyone.',
  'Quels moyens de paiement acceptez-vous ?':
    'Which payment methods do you accept?',
  "MTN Mobile Money, Airtel Money, carte bancaire et virement. En Mobile Money, 242Konnect envoie une demande de paiement sur votre téléphone : vous la validez avec votre code PIN, et rien n'est débité tant que vous ne l'avez pas saisi. Tous les paiements passent par 242Konnect : vous ne réglez jamais le prestataire directement, pas même un pourboire.":
    'MTN Mobile Money, Airtel Money, bank card and transfer. With Mobile Money, 242Konnect sends a payment request to your phone: you approve it with your PIN, and nothing is debited until you have entered it. Every payment goes through 242Konnect — you never pay the provider directly, not even a tip.',
  'Puis-je contacter directement un prestataire ?':
    'Can I contact a provider directly?',
  "Les échanges passent par la messagerie 242Konnect, et les numéros et adresses personnels des prestataires ne sont pas publiés. C'est ce qui permet de suivre la demande, la conversation et la prestation sur la plateforme, et de vous appuyer dessus en cas de litige. Aux États-Unis, le contact direct pourra être proposé selon le fonctionnement retenu.":
    'Exchanges go through 242Konnect messaging, and providers’ personal numbers and addresses are not published. That is what keeps the request, the conversation and the work itself on the platform, so you have something to rely on in a dispute. In the United States, direct contact may be offered depending on the arrangement chosen.',
  'Pourquoi payer avant la prestation ?':
    'Why pay before the work is done?',
  "Le paiement confirme la mission et permet au prestataire de se mettre en route. 242Konnect conserve la somme et ne la verse qu'après votre validation du travail. En cas de litige, elle reste bloquée jusqu'à la décision de la plateforme.":
    'Payment confirms the job and lets the provider set off. 242Konnect holds the money and only pays it out after you have approved the work. In a dispute it stays blocked until the platform decides.',
  'Quelle commission prend 242Konnect ?':
    'What commission does 242Konnect take?',
  '12 % du montant de la prestation, prélevés automatiquement au moment du versement. Ils couvrent le fonctionnement de la plateforme, la sécurisation des paiements, le support et la maintenance.':
    '12% of the job total, taken automatically at payout. It covers running the platform, securing payments, support and maintenance.',
  'Quand le prestataire est-il payé ?':
    'When is the provider paid?',
  'Après votre validation. En versement standard, sous 7 jours, avec 1,25 % de frais de traitement. En versement express, immédiatement, avec 4 % de frais.':
    'After you approve the work. Standard payout takes up to 7 days with a 1.25% processing fee. Express payout is immediate, with a 4% fee.',
  'Puis-je être remboursé ?':
    'Can I get a refund?',
  'Oui : annulation avant le début du service, litige tranché en votre faveur, paiement effectué par erreur ou service non réalisé.':
    'Yes: cancellation before the work starts, a dispute settled in your favour, a payment made by mistake, or work that was never done.',
  'Le paiement fonctionne-t-il vraiment ?':
    'Does payment actually work?',
  "Non, pas encore. Le parcours complet existe — montant, moyen de paiement, blocage des fonds, validation, commission et versement — mais aucun argent n'est débité ni versé. Un paiement réel demande un compte marchand et un serveur pour le traiter.":
    'Not yet. The whole flow exists — amount, payment method, holding the funds, approval, commission and payout — but no money is debited or paid out. A real payment needs a merchant account and a server to process it.',
  'Pourquoi mon numéro sert-il d’identifiant ?':
    'Why is my phone number my login?',
  "Parce qu'à Pointe-Noire c'est par téléphone qu'on se joint. L'indicatif se choisit à l'inscription — la République du Congo et les États-Unis sont pris en charge — et votre numéro est enregistré avec son indicatif, donc un numéro américain n'est jamais confondu avec un numéro congolais.":
    'Because in Pointe-Noire the phone is how people reach each other. You choose the country code when you sign up — the Republic of the Congo and the United States are supported — and your number is stored with its code, so a US number is never confused with a Congolese one.',
  'Où sont stockées mes données ?':
    'Where is my data stored?',
  "Votre profil — nom, photo, ville, et votre métier si vous êtes prestataire — est enregistré sur nos serveurs, protégé par une règle qui ne laisse lire et modifier que votre propre fiche. Votre mot de passe ne quitte jamais ce téléphone : nous n'en conservons aucune copie. Vos favoris, vos missions et vos messages restent eux aussi sur l'appareil et ne sont pas encore synchronisés.":
    'Your profile — name, photo, city, and your trade if you are a provider — is saved on our servers, protected by a rule that lets you read and change only your own record. Your password never leaves this phone: we keep no copy of it. Your favourites, jobs and messages also stay on the device and are not synchronised yet.',
  'Comment modifier mon profil ?':
    'How do I edit my profile?',
  "Onglet Profil, puis « Modifier le profil ». Vous pouvez changer votre nom, ajouter une photo et écrire quelques mots sur vous. Le numéro de téléphone n'est pas modifiable car il identifie le compte.":
    'The Profile tab, then “Edit profile”. You can change your name, add a photo and write a few words about yourself. The phone number cannot be changed, because it identifies the account.',
  'Comment devenir prestataire sur la plateforme ?':
    'How do I become a provider on the platform?',
  "Depuis l'onglet Profil, activez le profil Prestataire : un seul compte porte vos profils Particulier et Prestataire, avec un seul identifiant. Activer Prestataire ne vous enlève rien — vous continuez à chercher et à réserver comme avant, et un « Espace Prestataire » s'ajoute dans l'onglet Profil, avec votre métier, vos conditions et vos pièces justificatives. Les demandes reçues et les revenus y resteront vides tant qu'il n'y a pas d'autres utilisateurs.":
    'From the Profile tab, turn on the Provider profile: one account carries both your Customer and Provider profiles, with a single login. Turning on Provider takes nothing away — you go on searching and booking as before, and a “Provider space” is added in the Profile tab, with your trade, your terms and your supporting documents. Requests received and earnings stay empty there until there are other users.',
  'Que faire en cas de problème avec un professionnel ?':
    'What should I do if there is a problem with a professional?',
  "Gardez la conversation dans l'application : elle sert de trace. Le signalement et la médiation seront ajoutés avec l'espace professionnel.":
    'Keep the conversation inside the app: it is your record. Reporting and mediation will be added along with the professional space.',
  'Mes conversations sont-elles privées ?':
    'Are my conversations private?',
  'Elles restent sur votre appareil et ne sont envoyées à personne. Cela veut aussi dire que le professionnel ne les reçoit pas encore.':
    'They stay on your device and are not sent to anyone. That also means the professional does not receive them yet.',

  /* ---- V1 specifications: consent, pricing, dossier, order cycle ---- */
  'Modèle de prix':
    'Pricing model',
  'Devise selon votre pays :':
    'Currency for your country:',
  'Montant':
    'Amount',
  'Prix négociable':
    'Negotiable price',
  'Durées de mission acceptées':
    'Job lengths you accept',
  'Durée':
    'Duration',
  'Prestataire identifié':
    'Identified provider',
  'avis':
    'reviews',
  'Conditions d\'utilisation':
    'Terms of use',
  'Le service':
    'The service',
  '242Konnect met en relation des clients et des prestataires vérifiés. Toute demande, tout échange, tout devis et tout paiement passent par l\'application.':
    '242Konnect connects clients with verified providers. Every request, message, quote and payment goes through the app.',
  'Votre compte':
    'Your account',
  'Un numéro de téléphone et une adresse e-mail n\'appartiennent qu\'à un seul compte. Les informations fournies doivent être exactes. Le nom, le téléphone et le pays vérifiés ne se modifient qu\'avec le support.':
    'A phone number and an e-mail address belong to one account only. The information you give must be accurate. A verified name, phone number or country can only be changed through support.',
  'Paiements protégés':
    'Protected payments',
  '242Konnect conserve le paiement jusqu\'à la validation du service. Les paiements et négociations hors plateforme sont interdits et peuvent conduire à une suspension après contrôle.':
    '242Konnect holds the payment until the service is approved. Payments and negotiations outside the platform are forbidden and may lead to suspension after review.',
  'Annulations et litiges':
    'Cancellations and disputes',
  'Avant acceptation, une annulation est remboursée intégralement. Après acceptation, le remboursement dépend du préavis et du travail effectué. Un litige gèle les fonds pendant l\'examen du contrat, du chat, des horaires et des preuves.':
    'Before acceptance, a cancellation is refunded in full. After acceptance, the refund depends on the notice given and the work done. A dispute freezes the funds while the contract, chat, times and evidence are reviewed.',
  'Politique de confidentialité':
    'Privacy policy',
  'Localisation':
    'Location',
  'Utilisée pour proposer les services de votre pays et de votre ville, et seulement après votre autorisation. Votre adresse exacte reste privée jusqu\'à l\'acceptation d\'une mission.':
    'Used to show services in your country and city, and only with your permission. Your exact address stays private until a job is accepted.',
  'Photos et documents':
    'Photos and documents',
  'Votre photo de profil est visible des autres utilisateurs. Les pièces justificatives d\'un prestataire ne servent qu\'à sa vérification et ne sont jamais publiées.':
    'Your profile photo is visible to other users. A provider\'s supporting documents are used only for verification and are never published.',
  'Coordonnées':
    'Contact details',
  'Votre téléphone et votre e-mail ne sont jamais affichés publiquement. Les échanges passent par la messagerie de l\'application.':
    'Your phone number and e-mail are never shown publicly. Conversations go through the in-app messaging.',
  'Stockage local et mesure':
    'Local storage and analytics',
  'L\'application conserve votre session et vos préférences sur l\'appareil. Aucune technologie de mesure publicitaire n\'est utilisée.':
    'The app keeps your session and preferences on the device. No advertising analytics are used.',
  'Vos droits':
    'Your rights',
  'Vous pouvez consulter vos consentements, retirer l\'accord marketing et demander la correction ou la suppression de vos données depuis Profil › Confidentialité.':
    'You can review your consents, withdraw marketing consent and ask for your data to be corrected or deleted from Profile › Privacy.',
  'Contrat Prestataire':
    'Provider agreement',
  'Responsabilités':
    'Responsibilities',
  'Vous réalisez les missions acceptées avec soin, dans les délais convenus, et vous respectez les règles de sécurité de votre métier.':
    'You carry out accepted jobs with care, on the agreed schedule, and follow your trade\'s safety rules.',
  'Exactitude des informations':
    'Accuracy of information',
  'Votre identité, vos services, vos prix et vos pièces sont exacts. Une information fausse entraîne le refus ou la suspension du profil.':
    'Your identity, services, prices and documents are accurate. False information leads to the profile being refused or suspended.',
  'Paiements et frais':
    'Payments and fees',
  '242Konnect collecte le paiement du client et vous le verse après validation, déduction faite de la commission de 12 % et des frais de versement. Aucun paiement hors plateforme.':
    '242Konnect collects the client\'s payment and pays you after approval, less the 12% commission and payout fees. No payments outside the platform.',
  'Confidentialité':
    'Privacy',
  'Les coordonnées et l\'adresse exacte du client ne vous sont communiquées qu\'après acceptation, et uniquement pour la mission.':
    'The client\'s contact details and exact address are shared with you only after acceptance, and only for the job.',
  'Les annulations répétées ou tardives affectent votre score. En cas de litige, 242Konnect examine le contrat, le chat, les horaires et les preuves avant toute décision, et vous pouvez répondre.':
    'Repeated or late cancellations lower your score. In a dispute, 242Konnect reviews the contract, chat, times and evidence before any decision, and you can respond.',
  'Prix fixe':
    'Fixed price',
  'Un montant pour le service':
    'One amount for the service',
  'À partir de':
    'From',
  'Un prix de départ, ajusté selon le besoin':
    'A starting price, adjusted to the job',
  'Facturé à l\'heure':
    'Billed by the hour',
  'Sur devis':
    'Quote required',
  'Le prix est fixé après étude de la demande':
    'The price is set after reviewing the request',
  'Quelques heures':
    'A few hours',
  'Quelques jours':
    'A few days',
  'Quelques semaines':
    'A few weeks',
  '1 à 6 mois':
    '1 to 6 months',
  'Plus de 6 mois':
    'More than 6 months',
  'Choisissez un modèle de prix.':
    'Choose a pricing model.',
  'Indiquez un montant.':
    'Enter an amount.',
  '+ offrir mes services':
    '+ offer my services',
  'Un seul compte, plusieurs profils. « Offrir mes services » crée un dossier Prestataire vérifié par 242Konnect, sans toucher à votre profil Client. Le mode Business se demande séparément.':
    'One account, several profiles. “Offer my services” opens a provider application reviewed by 242Konnect, without touching your client profile. Business mode is requested separately.',
  'Mise à jour des conditions':
    'Updated terms',
  'Pour continuer, lisez et acceptez la version actuelle des documents ci-dessous. La date, l\'heure et la version sont enregistrées.':
    'To continue, read and accept the current version of the documents below. The date, time and version are recorded.',
  'Lire':
    'Read',
  'J\'accepte':
    'I accept',
  'Signature : votre nom complet':
    'Signature: your full name',
  'Accepter et continuer':
    'Accept and continue',
  'Le nom vérifié se corrige par une demande à 242Konnect, depuis Confidentialité.':
    'A verified name is corrected by request to 242Konnect, from Privacy.',
  'Dossier soumis':
    'Application submitted',
  'Reçu':
    'Received',
  'Complétez votre profil':
    'Complete your profile',
  'Identité':
    'Identity',
  'En examen par 242Konnect':
    'Under review by 242Konnect',
  'reçu(s)':
    'received',
  'Aucune pièce transmise':
    'No documents sent',
  'Décision finale':
    'Final decision',
  'Approuvé':
    'Approved',
  'En attente':
    'Pending',
  'Suivi de la vérification':
    'Verification progress',
  'Pendant l’examen, votre profil peut être prévisualisé avec un badge explicite, mais il ne peut pas être réservé avant approbation. En cas de refus, le motif vous est communiqué avec la possibilité de corriger.':
    'During review your profile can be previewed with a clear badge, but it cannot be booked until approved. If it is refused, you are told why and can correct it.',
  'Aperçu de votre profil':
    'Your profile preview',
  'Vérifié':
    'Verified',
  'En examen · non réservable':
    'Under review · not bookable',
  'Tarification':
    'Pricing',
  'Durées acceptées':
    'Accepted lengths',
  'signé le':
    'signed on',
  'Non signé':
    'Not signed',
  'Envoyée · fonds bloqués':
    'Sent · funds held',
  'Non acceptée':
    'Not accepted',
  'Acceptée':
    'Accepted',
  'Validée':
    'Approved',
  'Litige':
    'Dispute',
  'Annulée':
    'Cancelled',
  'En route':
    'On the way',
  'Arrivé':
    'Arrived',
  'Terminée':
    'Completed',
  'Plusieurs mois':
    'Several months',
  'Service récurrent':
    'Recurring service',
  'Actives':
    'Active',
  'Terminées':
    'Completed',
  'Annulées':
    'Cancelled',
  'Travail non conforme':
    'Work not as agreed',
  'Travail incomplet':
    'Work incomplete',
  'Prestataire absent':
    'Provider did not show up',
  'Dommages':
    'Damage',
  'Autre':
    'Other',
  'Reprise du travail':
    'Redo the work',
  'Remboursement partiel':
    'Partial refund',
  'Remboursement complet':
    'Full refund',
  'Aucune mission dans cette catégorie.':
    'No jobs in this category.',
  'contrat signé':
    'contract signed',
  'Adresse communiquée au prestataire':
    'Address shared with the provider',
  'Adresse privée jusqu’à acceptation':
    'Address private until accepted',
  'Le délai de réponse est dépassé.':
    'The response time has passed.',
  'Réponse attendue avant':
    'Response expected by',
  'Le prestataire n\'a pas accepté. Vos fonds restent protégés : choisissez un autre prestataire qualifié ou demandez le remboursement intégral.':
    'The provider did not accept. Your funds stay protected: choose another qualified provider or ask for a full refund.',
  'Remboursement':
    'Refund',
  'Choisir un autre prestataire':
    'Choose another provider',
  'Autre prestataire':
    'Another provider',
  'Validez ou signalez un problème sous':
    'Approve or report a problem within',
  'Les fonds restent bloqués jusqu\'à votre décision.':
    'The funds stay held until you decide.',
  'Annulée après acceptation : le remboursement est calculé selon le préavis et le travail effectué, après examen par 242Konnect. Les fonds restent bloqués d\'ici là.':
    'Cancelled after acceptance: the refund is calculated from the notice given and the work done, after review by 242Konnect. The funds stay held until then.',
  'Remboursée intégralement.':
    'Refunded in full.',
  'Annulée avant paiement : rien n’a été débité.':
    'Cancelled before payment: nothing was charged.',
  'Fonds gelés pendant l\'examen. 242Konnect examine le contrat, le chat, les horaires et les preuves ; le prestataire peut répondre. Aucun remboursement n\'est promis avant cette décision.':
    'Funds frozen during review. 242Konnect reviews the contract, chat, times and evidence; the provider can respond. No refund is promised before that decision.',
  'Revoir et payer':
    'Review and pay',
  'Annuler · remboursé':
    'Cancel · refunded',
  'Simuler un refus':
    'Simulate a decline',
  'Message':
    'Message',
  'Simuler l\'étape suivante':
    'Simulate next step',
  'Annuler (remboursement après examen)':
    'Cancel (refund after review)',
  'Demande envoyée. Réponse du prestataire attendue sous':
    'Request sent. The provider\'s response is expected within',
  'Récapitulatif de la commande':
    'Order summary',
  'Service':
    'Service',
  'Prestataire':
    'Provider',
  'Horaire':
    'Time',
  'Adresse':
    'Address',
  'Prix de la prestation':
    'Service price',
  'Frais de protection 242Konnect':
    '242Konnect protection fee',
  'Total autorisé':
    'Total authorised',
  'Vous payez 242Konnect maintenant et la demande est envoyée ensuite. Le paiement reste bloqué : il n\'est versé au prestataire qu\'après votre validation.':
    'You pay 242Konnect now and the request is sent afterwards. The payment stays held: it reaches the provider only after you approve.',
  'Annulation et remboursement':
    'Cancellation and refund',
  'Avant acceptation : remboursement intégral. Après acceptation : selon le préavis et le travail effectué, après examen. Refus ou absence de réponse sous 24 h : autre prestataire ou remboursement intégral.':
    'Before acceptance: full refund. After acceptance: based on notice and work done, after review. Declined or no answer within 24 h: another provider or a full refund.',
  'J\'autorise le paiement':
    'I authorise the payment',
  'J\'autorise 242Konnect à prélever':
    'I authorise 242Konnect to charge',
  'et à les conserver jusqu\'à ma validation.':
    'and to hold it until I approve.',
  'Le paiement reste bloqué pendant l\'examen. 242Konnect examine le contrat, le chat, les horaires et les preuves, et le prestataire peut répondre.':
    'The payment stays held during the review. 242Konnect reviews the contract, chat, times and evidence, and the provider can respond.',
  'Motif':
    'Reason',
  'Ce que vous demandez':
    'What you are asking for',
  'Détails':
    'Details',
  'Décrivez ce qui s\'est passé':
    'Describe what happened',
  'Détails du problème':
    'Problem details',
  'Ajouter une preuve photo':
    'Add photo evidence',
  'Ajouter une preuve':
    'Add evidence',
  'Envoyer le signalement':
    'Send the report',
  'Demande reçue. 242Konnect vous répondra par e-mail.':
    'Request received. 242Konnect will reply by e-mail.',
  'La demande n\'a pas pu être envoyée. Vérifiez votre connexion et réessayez.':
    'The request could not be sent. Check your connection and try again.',
  'Documents acceptés':
    'Accepted documents',
  'accepté le':
    'accepted on',
  'en attente d\'envoi':
    'waiting to be sent',
  'Non accepté':
    'Not accepted',
  'Préférences':
    'Preferences',
  'Communications marketing':
    'Marketing messages',
  'Optionnel. Nouveautés et offres de 242Konnect.':
    'Optional. News and offers from 242Konnect.',
  'L\'application conserve votre session et vos préférences sur cet appareil. Aucune technologie de mesure publicitaire n\'est utilisée.':
    'The app keeps your session and preferences on this device. No advertising analytics are used.',
  'Vos données':
    'Your data',
  'Responsable des données':
    'Data controller',
  '242Konnect — le contact dédié sera publié avant le lancement.':
    '242Konnect — the dedicated contact will be published before launch.',
  'Demander une correction':
    'Request a correction',
  'Demander la suppression':
    'Request deletion',
  'Ce qui doit être corrigé':
    'What needs correcting',
  'Motif (optionnel)':
    'Reason (optional)',
  'Une suppression est traitée après la clôture des missions et paiements en cours : les fonds bloqués et les litiges doivent pouvoir être justifiés.':
    'Deletion is processed once ongoing jobs and payments are closed: held funds and disputes must remain accountable.',
  'Envoyer la demande':
    'Send the request',
  'Demande préparée':
    'Request ready',
  'Votre demande est prête. Elle sera envoyée à {name} dès le paiement protégé : revoyez-la et payez depuis l\'onglet Missions.':
    'Your request is ready. It will be sent to {name} as soon as the protected payment is made: review and pay from the Jobs tab.',
  'Décrivez le besoin':
    'Describe what you need',
  'Ce qui doit être fait, les détails utiles':
    'What needs doing, useful details',
  'Description de la demande':
    'Request description',
  'Lieu de l\'intervention':
    'Job location',
  'Mon adresse enregistrée':
    'My saved address',
  'Une autre adresse':
    'Another address',
  'Quartier, avenue, numéro, repère':
    'District, street, number, landmark',
  'Adresse de l\'intervention':
    'Job address',
  'L\'adresse exacte reste privée jusqu\'à l\'acceptation. Le service couvre Pointe-Noire et le Congo : pour une autre ville, relancez une recherche locale.':
    'The exact address stays private until acceptance. The service covers Pointe-Noire and Congo: for another city, run a new local search.',
  'Contrat de projet et jalons':
    'Project contract and milestones',
  'Je signe le contrat de projet':
    'I sign the project contract',
  'Prix indicatif':
    'Indicative price',
  'Offrir mes services':
    'Offer my services',
  'Un dossier Prestataire séparé, vérifié par 242Konnect. Votre profil Client reste actif et inchangé ; le profil Prestataire n\'est réservable qu\'après approbation.':
    'A separate provider application, reviewed by 242Konnect. Your client profile stays active and unchanged; the provider profile can be booked only after approval.',
  'Pièces nécessaires':
    'What you will need',
  'Une photo de profil (obligatoire)':
    'A profile photo (required)',
  'Votre date de naissance — 16 ans minimum':
    'Your date of birth — 16 or older',
  'Votre métier, votre zone, votre modèle de prix et vos durées':
    'Your trade, area, pricing model and job lengths',
  'Jusqu\'à cinq pièces justificatives':
    'Up to five supporting documents',
  'La signature du contrat Prestataire':
    'Your signature on the provider agreement',
  'Changer la photo':
    'Change photo',
  'Ajouter une photo':
    'Add a photo',
  'Réservé aux 16 ans et plus.':
    'For ages 16 and over.',
  'Choisir un métier':
    'Choose a trade',
  'Expériences professionnelles (optionnel)':
    'Work experience (optional)',
  'J\'ai lu et j\'accepte le contrat Prestataire':
    'I have read and accept the provider agreement',
  'La signature doit reprendre votre nom complet.':
    'The signature must match your full name.',
  'Envoyer le dossier':
    'Submit application',
  'Score 242K : calculé à partir des missions réalisées, des avis, de la ponctualité et du taux d’annulation. « Professionnel vérifié » : identité et pièces contrôlées par 242Konnect. « Prestataire identifié » : identité confirmée, pièces en examen. « Business vérifié » : entreprise validée (bientôt).':
    'Score 242K: based on completed jobs, reviews, punctuality and cancellation rate. “Professional verified”: identity and documents checked by 242Konnect. “Identified provider”: identity confirmed, documents under review. “Business verified”: approved company (coming soon).',
  'Client · je cherche un service':
    'Client · I am looking for a service',
  'Je propose mes compétences':
    'I offer my skills',
  'Sur demande · validation 242Konnect requise':
    'On request · 242Konnect approval required',
  'Business, sur demande':
    'Business, on request',
  'Business':
    'Business',
  'Le compte Business demande une demande et une validation distinctes par 242Konnect. Il n\'est pas encore ouvert à l\'inscription : créez un compte Client ou Prestataire, la demande Business se fera ensuite avec le même identifiant.':
    'A Business account needs a separate request and approval by 242Konnect. It is not yet open for sign-up: create a Client or Provider account, and request Business later with the same login.',
  'Centres d\'intérêt (optionnel)':
    'Interests (optional)',
  'Jusqu\'à trois. Ils servent à vous recommander des services.':
    'Up to three. They are used to recommend services to you.',
  'Pièce d\'identité, attestation, certificat. Vérifiées par 242Konnect, jamais publiées.':
    'ID, certificate, attestation. Checked by 242Konnect, never published.',
  'Continuer vers les consentements':
    'Continue to consents',
  'Révision et contrat':
    'Review and agreement',
  'Consentements':
    'Consents',
  'Lisez puis acceptez. La date, l\'heure et la version acceptée sont enregistrées.':
    'Read, then accept. The date, time and accepted version are recorded.',
  'Modifier':
    'Edit',
  'Disponibilité':
    'Availability',
  'J\'accepte les conditions d\'utilisation':
    'I accept the terms of use',
  'J\'accepte la politique de confidentialité':
    'I accept the privacy policy',
  'Ouvrez le contrat pour pouvoir l\'accepter.':
    'Open the agreement to be able to accept it.',
  'Optionnel':
    'Optional',
  'Je souhaite recevoir les nouveautés et offres de 242Konnect':
    'I would like to receive news and offers from 242Konnect',
  'Portée et calendrier':
    'Scope and schedule',
  'Le travail décrit dans la demande, aux dates convenues dans le chat de la mission.':
    'The work described in the request, on the dates agreed in the job chat.',
  'Montant, acompte et jalons':
    'Amount, deposit and milestones',
  'Le montant est payé à 242Konnect et bloqué. Il est libéré par jalon, après votre validation de chaque étape.':
    'The amount is paid to 242Konnect and held. It is released milestone by milestone, after you approve each stage.',
  'Changements':
    'Changes',
  'Toute modification de prix, de portée ou d\'horaire exige un avenant accepté par les deux parties dans l\'application.':
    'Any change of price, scope or schedule needs an amendment accepted by both parties in the app.',
  'Retards':
    'Delays',
  'Un retard est signalé dans le chat ; un retard important permet un examen par 242Konnect.':
    'A delay is reported in the chat; a significant delay can be reviewed by 242Konnect.',
  'Avant acceptation : remboursement intégral. Après : selon le préavis et le travail effectué, après examen.':
    'Before acceptance: full refund. After: based on notice and work done, after review.',
  'Dès que possible':
    'As soon as possible',
  /* ---- Marketplace: directory, online requests, inbox, chat ---- */
  'Votre session a expiré. Reconnectez-vous.':
    'Your session has expired. Please sign in again.',
  'Le paiement Mobile Money n’a pas abouti.':
    'The Mobile Money payment did not go through.',
  'Demandes en ligne':
    'Online requests',
  'Annuler la demande en ligne':
    'Cancel the online request',
  'Revoir et payer la demande en ligne':
    'Review and pay the online request',
  'Ouvrir le chat de la demande':
    'Open the request chat',
  'Demander le remboursement de la demande en ligne':
    'Ask for a refund of the online request',
  'Annuler la mission en ligne':
    'Cancel the online job',
  'Le prestataire recevra':
    'The provider will receive',
  'après commission et frais de versement.':
    'after commission and payout fees.',
  'Signaler un problème sur la demande en ligne':
    'Report a problem with the online request',
  'Confirmer le paiement en ligne':
    'Confirm the online payment',
  'Payer et envoyer la demande':
    'Pay and send the request',
  'Chat de la demande':
    'Request chat',
  'Prestataires inscrits':
    'Registered providers',
  'Aucun prestataire inscrit dans votre pays pour le moment.':
    'No registered providers in your country yet.',
  'Prestataire inscrit':
    'Registered provider',
  'Statut 242Konnect':
    '242Konnect status',
  'Chargement…':
    'Loading…',
  'Votre profil n\'est pas encore publié. Il le sera à votre prochaine connexion en ligne.':
    'Your profile is not published yet. It will be the next time you are online.',
  'Profil approuvé : les clients peuvent vous réserver.':
    'Profile approved: clients can book you.',
  'Profil refusé. Corrigez-le depuis Modifier le profil : il repassera en examen.':
    'Profile refused. Correct it from Edit profile: it will go back under review.',
  'Profil publié, en examen par 242Konnect : visible avec un badge, pas encore réservable.':
    'Profile published and under review by 242Konnect: visible with a badge, not yet bookable.',
  'Demandes reçues':
    'Requests received',
  'Nouvelles':
    'New',
  'Acceptées':
    'Accepted',
  'Les demandes payées par les clients arriveront ici.':
    'Requests paid for by clients will appear here.',
  'Client':
    'Client',
  'vous recevrez':
    'you will receive',
  'Paiement bloqué par 242Konnect. Adresse exacte et coordonnées communiquées après acceptation. Répondez avant':
    'Payment held by 242Konnect. Exact address and contact details are shared after acceptance. Reply by',
  'Votre profil doit être approuvé pour accepter une demande.':
    'Your profile must be approved before you can accept a request.',
  'Refuser la demande':
    'Decline the request',
  'Refuser':
    'Decline',
  'Accepter la demande':
    'Accept the request',
  'Accepter':
    'Accept',
  'Étape suivante':
    'Next step',
  'Clôture demandée : le client valide ou signale un problème. Le paiement est versé après sa validation.':
    'Completion requested: the client approves or reports a problem. Payment is released after their approval.',
  'Le client a signalé un problème. Les fonds sont gelés pendant l’examen ; répondez dans le chat.':
    'The client reported a problem. Funds are frozen during the review; reply in the chat.',
  'Expirée':
    'Expired',
  'Les échanges restent dans 242Konnect : ils servent de preuve en cas de litige. Ne partagez ni numéro ni paiement hors de l\'application.':
    'Conversations stay in 242Konnect: they are the record if there is a dispute. Do not share phone numbers or payments outside the app.',
  'Aucun message pour le moment.':
    'No messages yet.',
  'Votre message':
    'Your message',
  'Envoyer le message':
    'Send the message',
  'Cette conversation est fermée.':
    'This conversation is closed.',
  'Connectez-vous à nouveau pour voir ce prestataire.':
    'Sign in again to see this provider.',
  'Professionnel vérifié':
    'Professional verified',
  'Le téléphone et l’e-mail du prestataire ne sont jamais affichés : la demande et la messagerie passent par 242Konnect.':
    'The provider\'s phone and e-mail are never shown: requests and messages go through 242Konnect.',
  'Ceci est votre propre profil, tel que les clients le voient.':
    'This is your own profile, as clients see it.',
  'Ce prestataire est en cours de vérification par 242Konnect. Il pourra être réservé après approbation.':
    'This provider is being verified by 242Konnect. They can be booked once approved.',
  'Ce prestataire travaille sur devis. La demande de devis arrive bientôt.':
    'This provider works on quotes. Quote requests are coming soon.',
  'Envoyer une demande à':
    'Send a request to',
  'Envoyer une demande':
    'Send a request',
  'Votre demande':
    'Your request',
  'Votre demande est prête. Elle sera envoyée dès le paiement protégé : revoyez-la et payez depuis l\'onglet Missions.':
    'Your request is ready. It will be sent as soon as the protected payment is made: review and pay from the Jobs tab.',
  'L\'adresse exacte reste privée jusqu\'à l\'acceptation.':
    'The exact address stays private until acceptance.',
  'Montant à autoriser':
    'Amount to authorise',
  'Préparer la demande':
    'Prepare the request',
  'Envoi…':
    'Sending…',
};
