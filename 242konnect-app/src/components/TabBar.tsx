import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import type { IconName } from '../icons';
import { colors, fonts, radius, shadow } from '../theme';

/**
 * Custom tab bar, because the design puts a raised circular action in the
 * middle of the row — that overhang can't be expressed with the default bar.
 *
 * The centre action is not a tab: it sits between Missions and Messages and
 * triggers "post a job", so it's rendered as a plain button rather than a
 * navigation destination.
 */

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName; label: string }> = {
  Accueil: { active: 'solar:home-2-bold', inactive: 'solar:home-2-bold', label: 'Accueil' },
  Missions: {
    active: 'solar:calendar-mark-linear',
    inactive: 'solar:calendar-mark-linear',
    label: 'Missions',
  },
  Messages: {
    active: 'solar:chat-round-dots-bold',
    inactive: 'solar:chat-round-dots-linear',
    label: 'Messages',
  },
  Profil: {
    active: 'solar:user-rounded-linear',
    inactive: 'solar:user-rounded-linear',
    label: 'Profil',
  },
};

/** Messages carries an unread dot in the design. */
const BADGED = new Set(['Messages']);

/** Screens that own the bottom of the viewport and must not share it. */
const FULL_BLEED_ROUTES = new Set(['Profil']);

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // The professional profile has its own "Réserver maintenant" action bar
  // pinned to the bottom. Leaving the tab bar up stacks two bars on top of each
  // other and buries the primary action, so the tab bar yields on that screen.
  const activeTab = state.routes[state.index];
  const nested = activeTab?.state;
  const nestedRouteName =
    nested && typeof nested.index === 'number' ? nested.routes[nested.index]?.name : undefined;
  if (nestedRouteName && FULL_BLEED_ROUTES.has(nestedRouteName)) return null;

  const renderTab = (routeKey: string, routeName: string, index: number) => {
    const focused = state.index === index;
    const meta = TAB_ICONS[routeName];
    if (!meta) return null;

    return (
      <Pressable
        key={routeKey}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(routeName);
        }}
        style={styles.tab}
      >
        <View>
          <Icon
            name={focused ? meta.active : meta.inactive}
            size={24}
            color={focused ? colors.primary : colors.mutedForeground}
          />
          {BADGED.has(routeName) && <View style={styles.badge} />}
        </View>
        <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };

  const routes = state.routes;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(12, insets.bottom) }]}>
      {routes.slice(0, 2).map((r, i) => renderTab(r.key, r.name, i))}

      <View style={styles.fabSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Publier une demande"
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Icon name="solar:add-square-bold" size={28} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {routes.slice(2).map((r, i) => renderTab(r.key, r.name, i + 2))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  tab: { alignItems: 'center', gap: 4, width: 64 },
  label: { fontSize: 10 },
  labelActive: { fontFamily: fonts.sansBold, color: colors.primary },
  labelInactive: { fontFamily: fonts.sansMedium, color: colors.mutedForeground },
  badge: {
    position: 'absolute',
    top: 0,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.destructive,
    borderWidth: 2,
    borderColor: colors.card,
  },
  // Lifts the action above the bar the way the design does.
  fabSlot: { width: 64, alignItems: 'center' },
  fab: {
    position: 'absolute',
    bottom: -6,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background,
    ...shadow.primaryGlow,
  },
  fabPressed: { opacity: 0.9 },
});
