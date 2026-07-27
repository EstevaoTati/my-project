import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { formatPhone, useAuth } from '../auth';
import { useStore } from '../store';
import { colors, fonts, radius, shadow } from '../theme';

/**
 * The Profil tab, once there's an account behind it.
 *
 * Rows that lead nowhere yet say so rather than doing nothing when tapped —
 * a setting that silently ignores you reads worse than one labelled as coming.
 */
const SOON = [
  { icon: 'solar:calendar-mark-linear', label: 'Historique des missions' },
  { icon: 'solar:chat-round-dots-linear', label: 'Moyens de paiement' },
  { icon: 'solar:bell-bing-bold-duotone', label: 'Préférences de notification' },
] as const;

export function AccountScreen() {
  const insets = useSafeAreaInsets();
  const { account, signOut } = useAuth();
  const { favoriteCount, city } = useStore();

  if (!account) return null;

  const initials = account.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Profil</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <View style={styles.identity}>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.phone}>+242 {formatPhone(account.phone)}</Text>
        </View>
        <View style={[styles.roleChip, account.role === 'pro' && styles.roleChipPro]}>
          <Text style={[styles.roleChipText, account.role === 'pro' && styles.roleChipTextPro]}>
            {account.role === 'pro' ? 'Professionnel' : 'Client'}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{favoriteCount}</Text>
          <Text style={styles.statLabel}>Favoris</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Missions</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={[styles.stat, styles.statWide]}>
          <Text style={styles.statCity} numberOfLines={1}>
            {city.split(',')[0]}
          </Text>
          <Text style={styles.statLabel}>Ville</Text>
        </View>
      </View>

      <View style={styles.list}>
        {SOON.map((row) => (
          <View key={row.label} style={styles.row}>
            <Icon name={row.icon} size={20} color={colors.mutedForeground} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowSoon}>Bientôt</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel="Se déconnecter"
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <Text style={styles.signOutLabel}>Se déconnecter</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        Ce compte est enregistré sur cet appareil uniquement. Il n'existe pas encore de serveur :
        vous ne pourrez pas vous connecter depuis un autre téléphone.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 18, color: colors.primaryForeground },
  identity: { flex: 1 },
  name: { fontFamily: fonts.heading, fontSize: 17, color: colors.foreground },
  phone: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
  },
  roleChipPro: { backgroundColor: colors.accent },
  roleChipText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.mutedForeground },
  roleChipTextPro: { color: colors.accentForeground },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statWide: { flex: 1.4 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },
  statValue: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.foreground },
  statCity: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground },
  statLabel: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  list: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  rowSoon: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.mutedForeground },
  signOut: {
    height: 52,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.destructive },
  pressed: { opacity: 0.85 },
  disclaimer: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
});
