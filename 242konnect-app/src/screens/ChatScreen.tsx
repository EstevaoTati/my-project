import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { ProAvatar } from '../components/Avatar';
import { getProfessional, professionalTrade } from '../data';
import { useStore } from '../store';
import type { MessagesStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Discussion'>;

export function ChatScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { threads, sendMessage, ensureThread } = useStore();
  const [draft, setDraft] = useState('');
  const scroller = useRef<ScrollView>(null);

  const pro = getProfessional(route.params.id);
  const thread = threads[route.params.id];

  useEffect(() => {
    ensureThread(route.params.id);
  }, [route.params.id, ensureThread]);

  const messages = thread?.messages ?? [];

  useEffect(() => {
    // New message should be visible without the reader scrolling for it.
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length]);

  if (!pro) return null;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    sendMessage(pro.id, text);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>
        <ProAvatar professional={pro} size={40} rounded={20} />
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>
            {pro.name}
          </Text>
          <Text style={styles.headerTrade} numberOfLines={1}>
            {professionalTrade(pro)?.label ?? ''}
          </Text>
        </View>
      </View>

      {/* Said plainly, because a thread that never answers otherwise reads as a
          bug rather than as a prototype without a counterparty. */}
      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          Démonstration : vos messages sont enregistrés sur cet appareil, mais personne ne les
          reçoit encore.
        </Text>
      </View>

      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <Text style={styles.hint}>
            Présentez votre besoin en quelques mots : le lieu, le problème et quand vous êtes
            disponible.
          </Text>
        )}
        {messages.map((m) => {
          const mine = m.from === 'me';
          return (
            <View key={m.id} style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.text}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Écrivez votre message"
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel="Écrivez votre message"
          returnKeyType="send"
          style={styles.input}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          accessibilityState={{ disabled: !draft.trim() }}
          style={[styles.send, !draft.trim() && styles.sendOff]}
        >
          <Icon name="solar:arrow-right-bold" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  back: {
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  headerText: { flex: 1 },
  headerName: { fontFamily: fonts.heading, fontSize: 16, color: colors.foreground },
  headerTrade: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  notice: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,203,5,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,203,5,0.4)',
  },
  noticeText: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 17, color: colors.foreground },
  messages: { padding: 20, gap: 10 },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
    textAlign: 'center',
    paddingVertical: 24,
  },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius['2xl'] },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: radius.xs },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.xs,
  },
  bubbleText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.foreground },
  bubbleTextMine: { color: colors.primaryForeground },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { backgroundColor: colors.mutedForeground, opacity: 0.5 },
});
