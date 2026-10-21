import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { OpenRequestSheet } from './online/OpenRequestSheet';
import { useAuth } from '../auth';
import type { IconName } from '../icons';
import { listConversations, marketplaceEnabled } from '../marketplace';
import { colors, fonts, radius, shadow } from '../theme';
import { T, useT } from '../i18n';
import { useProMode } from '../proTheme';

/**
 * Custom tab bar, because the design puts a raised circular action in the
 * middle of the row — that overhang can't be expressed with the default bar.
 *
 * The centre action is not a tab. For a client it publishes an open request;
 * for a prestataire it opens their publishing tools (spec "Bouton +").
 * In provider mode the active tab and the centre button are yellow, as the
 * mock-ups show; client mode keeps its black.
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

/** Screens that own the bottom of the viewport and must not share it. */
const FULL_BLEED_ROUTES = new Set(['Profil']);

/** Unread messages across this account's requests; polled, as there is no realtime yet. */
function useUnreadCount(enabled: boolean): number {
  const { marketSession } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled || !marketplaceEnabled) return;
    let alive = true;
    const load = async () => {
      const session = await marketSession();
      if (!session) return;
      try {
        const list = await listConversations(session);
        if (alive) setCount(list.reduce((n, c) => n + c.unread, 0));
      } catch {
        // A badge is not worth an error.
      }
    };
    load();
    const timer = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled, marketSession]);
  return count;
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [showPost, setShowPost] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const proMode = useProMode();
  const unread = useUnreadCount(proMode);

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
    // Client mode: a red dot as in the design. Provider mode: only when
    // something is actually unread (Messages §3.1).
    const badge = routeName === 'Messages' && (proMode ? unread > 0 : true);

    return (
      <Pressable
        key={routeKey}
        accessibilityRole="tab"
        aria-selected={focused}
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
          {badge && <View style={styles.badge} />}
        </View>
        <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>{t(meta.label)}</Text>
        {proMode && <View style={[styles.indicator, focused && styles.indicatorOn]} />}
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
            onPress={() => (proMode ? setShowPro(true) : setShowPost(true))}
            accessibilityRole="button"
            accessibilityLabel={proMode ? t('Publier') : t('Publier une demande')}
            style={({ pressed }) => [styles.fab, proMode && styles.fabPro, pressed && styles.fabPressed]}
          >
            <Icon name="solar:add-square-bold" size={28} color={proMode ? colors.accentForeground : colors.primaryForeground} />
          </Pressable>
        </View>

        {routes.slice(2).map((r, i) => renderTab(r.key, r.name, i + 2))}
      </View>

      <OpenRequestSheet
        visible={showPost}
        onClose={() => setShowPost(false)}
        onCreated={() => {
          setShowPost(false);
          navigation.navigate('Missions');
        }}
      />

      {/* Spec "Bouton +": publishing work to the gallery needs photo storage
          and moderation, which come in phase 2. Until then the button says so
          and offers the two things a prestataire does most. */}
      <Sheet visible={showPro} title={t('Publier')} onClose={() => setShowPro(false)}>
        <View style={styles.proSoon}>
          <Text style={styles.proSoonTitle}>{t('Partager une réalisation')}</Text>
          <Text style={styles.proSoonBody}>
            {t('Bientôt : photos et vidéo de vos travaux, avec l’accord du client, dans la galerie de votre profil.')}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            setShowPro(false);
            navigation.navigate('Missions', { tab: 'available' });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Voir les demandes disponibles')}
          style={styles.postRow}
        >
          <Icon name="solar:bell-bing-bold-duotone" size={22} color={colors.foreground} />
          <Text style={styles.postLabel}>{t('Voir les demandes disponibles')}</Text>
          <Icon name="solar:arrow-right-bold" size={18} color={colors.mutedForeground} />
        </Pressable>
        <Pressable
          onPress={() => {
            setShowPro(false);
            navigation.navigate('Profil', { screen: 'EspacePrestataire', initial: false });
          }}
          accessibilityRole="button"
          accessibilityLabel={t('Mon Espace Pro')}
          style={styles.postRow}
        >
          <Icon name="mdi:wrench" size={22} color={colors.foreground} />
          <Text style={styles.postLabel}>{t('Mon Espace Pro : services, documents, abonnement')}</Text>
          <Icon name="solar:arrow-right-bold" size={18} color={colors.mutedForeground} />
        </Pressable>
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
    paddingTop: 10,
  },
  tab: { alignItems: 'center', gap: 4, width: 64 },
  label: { fontSize: 10 },
  labelActive: { fontFamily: fonts.sansBold, color: colors.primary },
  labelInactive: { fontFamily: fonts.sansMedium, color: colors.mutedForeground },
  indicator: { width: 26, height: 3, borderRadius: 2, backgroundColor: 'transparent' },
  indicatorOn: { backgroundColor: colors.accent },
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
  fabPro: { backgroundColor: colors.accent },
  fabPressed: { opacity: 0.9 },
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
  proSoon: { backgroundColor: '#fff7d1', borderRadius: radius.xl, padding: 14, gap: 4, marginBottom: 12 },
  proSoonTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  proSoonBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
});
