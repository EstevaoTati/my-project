import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { promo } from '../data';
import type { AuthStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Bienvenue'>;

/** Three reasons to trust the marketplace, stated plainly. */
const PROMISES = [
  { icon: 'solar:shield-check-bold', text: 'Prestataires vérifiés près de chez vous' },
  { icon: 'solar:bolt-bold-duotone', text: 'Une réponse le jour même, souvent en urgence' },
  { icon: 'solar:star-bold', text: 'Tarifs annoncés à l’avance, en FCFA' },
] as const;

/**
 * "Découvrir 242Konnect", the third option the directives ask for on the
 * Commencer screen. The content is the platform's own — mission, method and
 * values — taken from the cahier des charges rather than invented marketing.
 */
const STEPS = [
  { n: '1', title: 'Décrivez votre besoin', body: 'Choisissez un métier, indiquez la date, le lieu et votre budget.' },
  { n: '2', title: 'Recevez des propositions', body: 'Les prestataires qualifiés répondent, avec leur prix et leurs délais.' },
  { n: '3', title: 'Payez via 242Konnect', body: "Le montant est conservé par la plateforme jusqu'à ce que vous validiez le travail." },
  { n: '4', title: 'Validez et évaluez', body: 'Le prestataire est payé après votre validation, et vous notez la prestation.' },
];

const VALUES = [
  ['Confiance', 'Transparence, fiabilité et respect des engagements.'],
  ['Compétence', 'Des professionnels qualifiés, encouragés à l’excellence.'],
  ['Connexion', 'Des mises en relation simples, rapides et efficaces.'],
  ['Sécurité', 'Vos données et vos paiements sont protégés.'],
  ['Simplicité', 'Accéder à un service en quelques clics.'],
  ['Réactivité', 'Des réponses rapides et une communication fluide.'],
];

export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [showDiscover, setShowDiscover] = useState(false);

  return (
    <View style={styles.root}>
      <Image source={promo.image} style={styles.hero} />
      {/* The photo carries the mood; the gradient keeps the type legible over it.
          The last stop lands at 0.62, exactly where the photo ends — any later
          and the gradient is still translucent at the image's bottom edge,
          which shows up as a hard horizontal seam across the screen. */}
      <LinearGradient
        colors={['rgba(10,10,10,0.3)', 'rgba(10,10,10,0.88)', colors.black]}
        locations={[0, 0.45, 0.62]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 32, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
        <View style={styles.brandRow}>
          {/* The mark repeats the flag: one stripe per colour, the same order
              as the splash wordmark. */}
          <View style={styles.brandMark}>
            <View style={[styles.brandStripe, { backgroundColor: colors.logoGreen }]} />
            <View style={[styles.brandStripe, { backgroundColor: colors.logoYellow }]} />
            <View style={[styles.brandStripe, { backgroundColor: colors.logoRed }]} />
          </View>
          <Text style={styles.brand}>
            <Text style={{ color: colors.logoGreen }}>2</Text>
            <Text style={{ color: colors.logoYellow }}>4</Text>
            <Text style={{ color: colors.logoRed }}>2</Text>
            <Text style={{ color: colors.white }}>Konnect</Text>
          </Text>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.headline}>Chaque problème est un besoin de compétence.</Text>
        <Text style={styles.sub}>
          Trouvez un plombier, un électricien, une aide-ménagère ou un mécanicien vérifié à
          Pointe-Noire. Just One Click.
        </Text>

        <View style={styles.promises}>
          {PROMISES.map((p) => (
            <View key={p.text} style={styles.promise}>
              <Icon name={p.icon} size={20} color={colors.accent} />
              <Text style={styles.promiseText}>{p.text}</Text>
            </View>
          ))}
        </View>

        {/* Yellow, not black: the primary action sits on a black ground here, so
            the charte's accent is what carries it. */}
        <Pressable
          onPress={() => navigation.navigate('Inscription')}
          accessibilityRole="button"
          accessibilityLabel="Créer un compte"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>Créer un compte</Text>
          <Icon name="solar:arrow-right-bold" size={20} color={colors.accentForeground} />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Connexion')}
          accessibilityRole="button"
          accessibilityLabel="J'ai déjà un compte, se connecter"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>J'ai déjà un compte</Text>
        </Pressable>

        <Pressable
          onPress={() => setShowDiscover(true)}
          accessibilityRole="button"
          accessibilityLabel="Découvrir 242Konnect"
          style={({ pressed }) => [styles.tertiary, pressed && styles.pressed]}
        >
          <Text style={styles.tertiaryLabel}>Découvrir 242Konnect</Text>
        </Pressable>
      </View>

      <Sheet visible={showDiscover} title="Découvrir 242Konnect" onClose={() => setShowDiscover(false)}>
        <Text style={styles.discoverLead}>
          242Konnect met en relation les particuliers, les entreprises et les professionnels
          qualifiés, et centralise tout le parcours : recherche, réservation, paiement, suivi et
          évaluation.
        </Text>

        <Text style={styles.discoverHeading}>Comment ça marche</Text>
        {STEPS.map((step) => (
          <View key={step.n} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberLabel}>{step.n}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepText}>{step.body}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.discoverHeading}>Nos valeurs</Text>
        {VALUES.map(([name, body]) => (
          <View key={name} style={styles.value}>
            <Text style={styles.valueName}>{name}</Text>
            <Text style={styles.valueText}>{body}</Text>
          </View>
        ))}

        <Pressable
          onPress={() => {
            setShowDiscover(false);
            navigation.navigate('Inscription');
          }}
          accessibilityRole="button"
          accessibilityLabel="Créer un compte maintenant"
          style={styles.discoverCta}
        >
          <Text style={styles.discoverCtaLabel}>Créer un compte</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  hero: { position: 'absolute', top: 0, left: 0, width: '100%', height: '62%' },
  content: { flex: 1, paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  brandStripe: { flex: 1, width: '100%' },
  brand: { fontFamily: fonts.heading, fontSize: 20, color: colors.white },
  spacer: { flex: 1 },
  headline: { fontFamily: fonts.heading, fontSize: 32, lineHeight: 38, color: colors.white, marginBottom: 12 },
  sub: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.72)', marginBottom: 24 },
  promises: { gap: 10, marginBottom: 24 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promiseText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: 'rgba(255,255,255,0.92)' },
  primary: {
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.primaryGlow,
  },
  primaryLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.accentForeground },
  secondary: {
    height: 52,
    marginTop: 12,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.white },
  tertiary: { height: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  tertiaryLabel: { fontFamily: fonts.sansMedium, fontSize: 14, color: 'rgba(255,255,255,0.66)' },
  pressed: { opacity: 0.85 },

  discoverLead: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21, color: colors.mutedForeground },
  discoverHeading: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginTop: 20,
    marginBottom: 10,
  },
  step: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberLabel: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.accentForeground },
  stepBody: { flex: 1 },
  stepTitle: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  stepText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  value: { marginBottom: 10 },
  valueName: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  valueText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  discoverCta: {
    height: 52,
    marginTop: 8,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoverCtaLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryForeground },
});
