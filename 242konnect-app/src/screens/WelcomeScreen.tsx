import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { promo } from '../data';
import type { AuthStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Bienvenue'>;

/** Three reasons to trust the marketplace, stated plainly. */
const PROMISES = [
  { icon: 'solar:shield-check-bold', text: 'Professionnels vérifiés près de chez vous' },
  { icon: 'solar:bolt-bold-duotone', text: 'Une réponse le jour même, souvent en urgence' },
  { icon: 'solar:star-bold', text: 'Tarifs annoncés à l’avance, en FCFA' },
] as const;

export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Image source={promo.image} style={styles.hero} />
      {/* The photo carries the mood; the gradient keeps the type legible over it. */}
      <LinearGradient
        colors={['rgba(15,23,42,0.35)', 'rgba(15,23,42,0.9)', colors.secondary]}
        // The last stop lands at 0.62, exactly where the photo ends. Any later
        // and the gradient is still translucent at the image's bottom edge,
        // which shows up as a hard horizontal seam across the screen.
        locations={[0, 0.45, 0.62]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + 32, paddingBottom: Math.max(28, insets.bottom + 16) }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>242</Text>
          </View>
          <Text style={styles.brand}>242Konnect</Text>
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
              <Icon name={p.icon} size={20} color={colors.primary} />
              <Text style={styles.promiseText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => navigation.navigate('Inscription')}
          accessibilityRole="button"
          accessibilityLabel="Créer un compte"
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>Créer un compte</Text>
          <Icon name="solar:arrow-right-bold" size={20} color={colors.primaryForeground} />
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('Connexion')}
          accessibilityRole="button"
          accessibilityLabel="J'ai déjà un compte, se connecter"
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>J'ai déjà un compte</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.secondary },
  hero: { position: 'absolute', top: 0, left: 0, width: '100%', height: '62%' },
  content: { flex: 1, paddingHorizontal: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.accentForeground },
  brand: { fontFamily: fonts.heading, fontSize: 20, color: colors.white },
  spacer: { flex: 1 },
  headline: {
    fontFamily: fonts.heading,
    fontSize: 32,
    lineHeight: 38,
    color: colors.white,
    marginBottom: 12,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 24,
  },
  promises: { gap: 10, marginBottom: 28 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  promiseText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: 'rgba(255,255,255,0.92)' },
  primary: {
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow.primaryGlow,
  },
  primaryLabel: { fontFamily: fonts.sansBold, fontSize: 17, color: colors.primaryForeground },
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
  pressed: { opacity: 0.85 },
});
