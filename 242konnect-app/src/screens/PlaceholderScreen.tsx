import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import type { IconName } from '../icons';
import { colors, fonts } from '../theme';
import { useT } from '../i18n';

type Props = {
  title: string;
  icon: IconName;
  body: string;
};

/**
 * Missions, Messages and Profil appear in the design's tab bar but were never
 * designed as screens. They're stubbed rather than omitted so the tab bar is
 * honest: every destination leads somewhere and says plainly that it's next,
 * instead of a tap that silently does nothing.
 */
export function PlaceholderScreen({ title, icon, body }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.center}>
        <View style={styles.iconWrap}>
          <Icon name={icon} size={32} color={colors.mutedForeground} />
        </View>
        <Text style={styles.heading}>{t('Bientôt disponible')}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heading: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
});
