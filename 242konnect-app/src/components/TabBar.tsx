import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { categories } from '../data';
import type { IconName } from '../icons';
import { colors, fonts, radius, shadow } from '../theme';
import { T, useT } from '../i18n';

/**
 * Custom tab bar, because the design puts a raised circular action in the
 * middle of the row — that overhang can't be expressed with the default bar.
 *
 * The centre action is not a tab: it sits between Missions and Messages and
 * triggers "post a job", so it's rendered as a plain button rather than a
 * navigation destination.
 */

const TAB_ICONS: Record<string, { active: IconName; inactive: IconName; label: string }> = {
  Accueil: { active: 'solar:home-2-bold', inactive: 'solar:home-2-bold', label: T('Accueil') },
  Missions: {
    active: 'solar:calendar-mark-linear',
    inactive: 'solar:calendar-mark-linear',
    label: T('Missions'),
  },
  Messages: {
    active: 'solar:chat-round-dots-bold',
    inactive: 'solar:chat-round-dots-linear',
    label: T('Messages'),
  },
  Profil: {
    active: 'solar:user-rounded-linear',
    inactive: 'solar:user-rounded-linear',
    label: T('Profil'),
  },
};

/** Messages carries an unread dot in the design. */
const BADGED = new Set(['Messages']);

/** Screens that own the bottom of the viewport and must not share it. */
const FULL_BLEED_ROUTES = new Set(['Profil']);

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [showPost, setShowPost] = useState(false);
  const [posted, setPosted] = useState<string | null>(null);

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
        accessibilityLabel={t(meta.label)}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
          if (event.defaultPrevented) return;
          const target = state.routes[index];
          const nested = target?.state;
          const nestedKey = nested?.key;
          const nestedName =
            nested && typeof nested.index === 'number' ? nested.routes[nested.index]?.name : undefined;

          if (focused) {
            // Tapping the tab you're already on returns to its root — what
            // people expect, and the quickest way out of a nested screen.
            if (nestedKey) navigation.dispatch({ ...StackActions.popToTop(), target: nestedKey });
            return;
          }

          navigation.navigate(routeName);

          // If that tab was left on a screen that hides the tab bar, switching
          // to it would strand you there with no way back to the other tabs.
          // Return it to its root so the bar is always available.
          if (nestedKey && nestedName && FULL_BLEED_ROUTES.has(nestedName)) {
            navigation.dispatch({ ...StackActions.popToTop(), target: nestedKey });
          }
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
          {t(meta.label)}
        </Text>
      </Pressable>
    );
  };

  const routes = state.routes;

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(12, insets.bottom) }]}>
        {routes.slice(0, 2).map((r, i) => renderTab(r.key, r.name, i))}

        <View style={styles.fabSlot}>
          <Pressable
            onPress={() => {
              setPosted(null);
              setShowPost(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Publier une demande')}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            <Icon name="solar:add-square-bold" size={28} color={colors.primaryForeground} />
          </Pressable>
        </View>

        {routes.slice(2).map((r, i) => renderTab(r.key, r.name, i + 2))}
      </View>

      <Sheet
        visible={showPost}
        title={posted ? 'Demande publiée' : 'Publier une demande'}
        onClose={() => setShowPost(false)}
      >
        {posted ? (
          <View style={styles.posted}>
            <View style={styles.postedIcon}>
              <Icon name="solar:shield-check-bold" size={32} color={colors.primary} />
            </View>
            <Text style={styles.postedTitle}>{t('Votre demande est en ligne')}</Text>
            <Text style={styles.postedBody}>
              Les professionnels en {posted.toLowerCase()} près de chez vous vont recevoir votre
              demande et vous répondre directement.
            </Text>
            <Pressable
              onPress={() => setShowPost(false)}
              accessibilityRole="button"
              style={styles.postedButton}
            >
              <Text style={styles.postedButtonLabel}>{t('Terminé')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.postHint}>{t('De quel service avez-vous besoin ?')}</Text>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setPosted(category.label)}
                accessibilityRole="button"
                accessibilityLabel={`Publier une demande en ${category.label}`}
                style={styles.postRow}
              >
                <Icon name={category.icon} size={24} color={colors.foreground} />
                <Text style={styles.postLabel}>{category.label}</Text>
                <Icon name="solar:arrow-right-bold" size={20} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </>
        )}
      </Sheet>
    </>
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
  postHint: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, marginBottom: 12 },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  postLabel: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  posted: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  postedIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  postedTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground },
  postedBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginBottom: 8,
  },
  postedButton: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  postedButtonLabel: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.primaryForeground },
});
