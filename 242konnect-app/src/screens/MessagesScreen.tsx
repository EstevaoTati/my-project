import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { ProAvatar } from '../components/Avatar';
import { getProfessional, professionalTrade } from '../data';
import { useStore } from '../store';
import type { MessagesStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Conversations'>;

/** "il y a 5 min" — relative time reads better than a clock in a thread list. */
export function relativeTime(at: number): string {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} j`;
}

export function MessagesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { threads } = useStore();

  const list = Object.values(threads)
    .map((thread) => ({ thread, pro: getProfessional(thread.professionalId) }))
    .filter((row): row is { thread: typeof row.thread; pro: NonNullable<typeof row.pro> } => !!row.pro)
    .sort((a, b) => {
      const at = a.thread.messages.at(-1)?.at ?? 0;
      const bt = b.thread.messages.at(-1)?.at ?? 0;
      return bt - at;
    });

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {list.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="solar:chat-round-dots-linear" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>Aucune conversation</Text>
          <Text style={styles.emptyBody}>
            Ouvrez le profil d'un professionnel et appuyez sur le bouton message pour démarrer un
            échange.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {list.map(({ thread, pro }) => {
            const last = thread.messages.at(-1);
            return (
              <Pressable
                key={pro.id}
                onPress={() => navigation.navigate('Discussion', { id: pro.id })}
                accessibilityRole="button"
                accessibilityLabel={`Conversation avec ${pro.name}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <ProAvatar professional={pro} size={52} rounded={26} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {pro.name}
                    </Text>
                    {!!last && <Text style={styles.rowTime}>{relativeTime(last.at)}</Text>}
                  </View>
                  <Text style={styles.rowTrade} numberOfLines={1}>
                    {professionalTrade(pro)?.label ?? ''}
                  </Text>
                  <Text style={styles.rowPreview} numberOfLines={1}>
                    {last ? (last.from === 'me' ? 'Vous : ' : '') + last.text : 'Nouvelle conversation'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  list: { padding: 20, paddingTop: 4, gap: 12 },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  pressed: { opacity: 0.85 },
  rowBody: { flex: 1, justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowName: { flex: 1, fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  rowTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  rowTrade: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  rowPreview: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, paddingBottom: 120 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
  },
});
