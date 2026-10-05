import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Sheet } from '../Sheet';
import { useAuth } from '../../auth';
import {
  isExpired,
  listMessages,
  sendMessage,
  type RemoteMessage,
  type RemoteRequest,
  type RequestStatus,
} from '../../marketplace';
import { STAGES, type MissionStage } from '../../store';
import type { SupabaseSession } from '../../supabase';
import { colors, fonts, radius } from '../../theme';
import { T, useT } from '../../i18n';

/**
 * Loads something from the marketplace and keeps it fresh while the screen is
 * in view. There is no realtime channel yet, so a request accepted on the
 * prestataire's phone reaches the client within one interval rather than
 * instantly — stated here so nobody mistakes the delay for a bug.
 */
export function useMarketData<T>(
  load: (session: SupabaseSession) => Promise<T>,
  intervalMs = 15000
): { data: T | null; error: string | null; refresh: () => Promise<void>; signedOut: boolean } {
  const { marketSession } = useAuth();
  const focused = useIsFocused();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    const session = await marketSession();
    if (!session) {
      setSignedOut(true);
      return;
    }
    setSignedOut(false);
    try {
      setData(await loadRef.current(session));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [marketSession]);

  useEffect(() => {
    if (!focused) return;
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [focused, refresh, intervalMs]);

  return { data, error, refresh, signedOut };
}

export const STAGE_LABELS: Record<MissionStage, string> = {
  accepted: T('Acceptée'),
  on_the_way: T('En route'),
  arrived: T('Arrivé'),
  in_progress: T('En cours'),
  completed: T('Terminée'),
};

/** One label per state, the same on both sides of the request. */
export function requestStatusLabel(r: RemoteRequest): string {
  if (isExpired(r)) return T('Expirée');
  const labels: Record<RequestStatus, string> = {
    draft: T('À payer'),
    sent: T('Envoyée · fonds bloqués'),
    refused: T('Non acceptée'),
    accepted: T('Acceptée'),
    validated: T('Validée'),
    disputed: T('Litige'),
    cancelled: T('Annulée'),
  };
  return r.status === 'accepted' && r.stage ? STAGE_LABELS[r.stage] : labels[r.status];
}

/** Commande §08: every step, with the server's own time for each. */
export function StageTracker({ request }: { request: RemoteRequest }) {
  const t = useT();
  const current = STAGES.indexOf(request.stage ?? 'accepted');
  return (
    <View style={styles.tracker}>
      {STAGES.map((stage, i) => {
        const at = request.stageAt[stage];
        return (
          <View key={stage} style={styles.trackerRow}>
            <View style={[styles.dot, i <= current && styles.dotOn]} />
            <Text style={[styles.trackerLabel, i <= current && styles.trackerLabelOn]}>{t(STAGE_LABELS[stage])}</Text>
            {!!at && (
              <Text style={styles.trackerTime}>
                {new Date(at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

/**
 * The chat attached to one request (Client §13: "Ouvrir le chat dans le
 * contexte de la demande et conserver les échanges"). Stored in
 * `request_messages`, readable by the two parties and nobody else.
 */
export function RequestChatSheet({
  request,
  title,
  onClose,
}: {
  request: RemoteRequest | null;
  title: string;
  onClose: () => void;
}) {
  const t = useT();
  const { marketSession } = useAuth();
  const [messages, setMessages] = useState<RemoteMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = request?.id;

  const load = useCallback(async () => {
    if (!requestId) return;
    const session = await marketSession();
    if (!session) return;
    setMe(session.userId);
    try {
      setMessages(await listMessages(session, requestId));
    } catch (e) {
      setError(e instanceof Error ? e.message : null);
    }
  }, [requestId, marketSession]);

  useEffect(() => {
    if (!requestId) return;
    setMessages([]);
    setError(null);
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [requestId, load]);

  const writable = !!request && ['sent', 'accepted', 'disputed'].includes(request.status);

  const send = async () => {
    const body = draft.trim();
    if (!body || !requestId) return;
    const session = await marketSession();
    if (!session) return;
    try {
      await sendMessage(session, requestId, body);
      setDraft('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message non envoyé.");
    }
  };

  return (
    <Sheet visible={!!request} title={title} onClose={onClose}>
      <Text style={styles.note}>{t("Les échanges restent dans 242Konnect : ils servent de preuve en cas de litige. Ne partagez ni numéro ni paiement hors de l'application.")}</Text>
      <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent}>
        {messages.length === 0 && <Text style={styles.note}>{t('Aucun message pour le moment.')}</Text>}
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.senderId === me ? styles.mine : styles.theirs]}>
            <Text style={[styles.bubbleText, m.senderId === me && styles.mineText]}>{m.body}</Text>
          </View>
        ))}
      </ScrollView>
      {!!error && <Text style={styles.error}>{error}</Text>}
      {writable ? (
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('Votre message')}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t('Votre message')}
            style={styles.input}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('Envoyer le message')}
            style={[styles.send, !draft.trim() && styles.sendOff]}
          >
            <Text style={styles.sendLabel}>{t('Envoyer')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.note}>{t('Cette conversation est fermée.')}</Text>
      )}
    </Sheet>
  );
}

export const onlineStyles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headBody: { flex: 1 },
  name: { fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  sub: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.mutedForeground },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.lg, backgroundColor: colors.muted },
  chipText: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.foreground },
  line: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  body: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 19, color: colors.foreground },
  amount: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  actions: { flexDirection: 'row', gap: 10 },
  ghost: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.mutedForeground },
  solid: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidOff: { opacity: 0.5 },
  solidLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryForeground },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
});

const styles = StyleSheet.create({
  tracker: { gap: 6 },
  trackerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.success },
  trackerLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  trackerLabelOn: { fontFamily: fonts.sansSemibold, color: colors.foreground },
  trackerTime: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground, marginBottom: 8 },
  thread: { maxHeight: 280 },
  threadContent: { gap: 6, paddingVertical: 4 },
  bubble: { maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.xl },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.muted },
  bubbleText: { fontFamily: fonts.sans, fontSize: 14, color: colors.foreground },
  mineText: { color: colors.primaryForeground },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive, marginTop: 6 },
  composer: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
  },
  send: {
    paddingHorizontal: 16,
    height: 46,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.5 },
  sendLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryForeground },
});
