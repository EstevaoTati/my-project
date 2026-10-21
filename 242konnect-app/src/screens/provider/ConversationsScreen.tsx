import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { useAuth } from '../../auth';
import { getRequest, listConversations, type Conversation, type RemoteRequest } from '../../marketplace';
import { colors, fonts, radius } from '../../theme';
import { T, useT } from '../../i18n';
import { RequestChatSheet, STAGE_LABELS, useMarketData } from '../../components/online/shared';
import { relativeTime } from '../MessagesScreen';
import { s as w, Segmented, shortName, tradeLabel } from './workspace';

type Filter = 'all' | 'unread' | 'active' | 'archived';

const ACTIVE = new Set(['sent', 'accepted', 'disputed']);

/**
 * Messages — spec "Bouton Messages" §3.1–3.3, mock-ups "Messages" and the
 * conversation.
 *
 * One conversation per request, opened by a request or a booking and never
 * cold (§3.2): there is no way to search for a user and write to them.
 * Unread counts come from the server, so they agree across devices.
 */
export function ConversationsScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { marketSession } = useAuth();
  const { data, error, refresh } = useMarketData(listConversations, 10000);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [chat, setChat] = useState<RemoteRequest | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const list = (data ?? []).filter((c) => {
    if (filter === 'unread' && c.unread === 0) return false;
    if (filter === 'active' && !ACTIVE.has(c.status)) return false;
    if (filter === 'archived' && ACTIVE.has(c.status)) return false;
    return !q || [c.counterpart, t(tradeLabel(c.tradeId)), c.requestId.slice(0, 8)].some((f) => f.toLowerCase().includes(q));
  });

  const openConversation = async (c: Conversation) => {
    setOpenError(null);
    const session = await marketSession();
    if (!session) return setOpenError(t('Votre session a expiré. Reconnectez-vous.'));
    try {
      const request = await getRequest(session, c.requestId);
      if (!request) throw new Error(t('Cette conversation n’est plus disponible.'));
      setChat(request);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : t('Action impossible.'));
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('Messages')}</Text>
        <View style={styles.search}>
          <Icon name="solar:magnifer-linear" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('Rechercher une conversation')}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t('Rechercher une conversation')}
            style={styles.searchInput}
          />
        </View>
        <Segmented
          label={t('Filtrer les conversations')}
          options={[
            { id: 'all' as const, label: T('Toutes') },
            { id: 'unread' as const, label: T('Non lues') },
            { id: 'active' as const, label: T('Actives') },
            { id: 'archived' as const, label: T('Archivées') },
          ]}
          value={filter}
          onChange={setFilter}
        />
        {!!error && <Text style={w.error}>{error}</Text>}
        {!!openError && <Text style={w.error}>{openError}</Text>}
        {data && list.length === 0 && (
          <Text style={styles.empty}>
            {data.length === 0 ? t('Aucune conversation pour le moment.') : t('Aucune conversation dans ce filtre.')}
          </Text>
        )}

        <View style={styles.list}>
          {list.map((c) => {
            const name = shortName(c.counterpart) || t(c.iAm === 'prestataire' ? 'Client' : 'Prestataire');
            const status =
              c.status === 'accepted' && c.stage
                ? t(STAGE_LABELS[c.stage])
                : c.status === 'validated'
                  ? t('Validée')
                  : c.status === 'sent'
                    ? t('En attente')
                    : c.status === 'disputed'
                      ? t('Litige')
                      : t('Fermée');
            return (
              <Pressable
                key={c.requestId}
                onPress={() => openConversation(c)}
                accessibilityRole="button"
                accessibilityLabel={`${t('Conversation avec')} ${name}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(name[0] ?? '?').toUpperCase()}</Text>
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.time}>{relativeTime(Date.parse(c.lastAt))}</Text>
                  </View>
                  <Text style={styles.trade} numberOfLines={1}>
                    {t(tradeLabel(c.tradeId))}
                  </Text>
                  <View style={styles.rowTop}>
                    <View style={[styles.status, ACTIVE.has(c.status) && styles.statusLive]}>
                      <Text style={styles.statusLabel}>{status}</Text>
                    </View>
                    {c.unread > 0 && (
                      <View style={styles.unread} accessibilityLabel={t('{n} non lus', { n: c.unread })}>
                        <Text style={styles.unreadLabel}>{c.unread}</Text>
                      </View>
                    )}
                  </View>
                  {!!c.lastBody && (
                    <Text style={[styles.preview, c.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                      {c.lastMine ? `${t('Vous')} : ` : ''}
                      {c.lastBody}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Icon name="solar:chat-round-dots-linear" size={18} color={colors.mutedForeground} />
          <Text style={styles.footerText}>{t('Une conversation s’ouvre seulement après une demande de service ou une réservation.')}</Text>
        </View>
      </ScrollView>

      <RequestChatSheet
        request={chat}
        title={chat ? t(tradeLabel(chat.tradeId)) : ''}
        onClose={() => {
          setChat(null);
          refresh();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 140, gap: 14 },
  title: { fontFamily: fonts.headingBold, fontSize: 32, color: colors.foreground },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.foreground },
  empty: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  list: { backgroundColor: colors.card, borderRadius: radius['2xl'], borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.muted },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff7d1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 18, color: colors.foreground },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  time: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  trade: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  status: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.muted },
  statusLive: { backgroundColor: colors.successSurface },
  statusLabel: { fontFamily: fonts.sansSemibold, fontSize: 11, color: colors.foreground },
  unread: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  unreadLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.accentForeground },
  preview: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  previewUnread: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingHorizontal: 12 },
  footerText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 17, color: colors.mutedForeground, textAlign: 'center' },
});
