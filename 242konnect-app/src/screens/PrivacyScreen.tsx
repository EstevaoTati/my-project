import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { Field } from '../components/form';
import { useAuth } from '../auth';
import {
  latestConsents,
  PRIVACY,
  PRIVACY_CONTACT,
  PROVIDER_CONTRACT,
  TERMS,
  type ConsentKind,
  type DataRequestKind,
  type LegalDocument,
} from '../consent';
import type { AccountStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = NativeStackScreenProps<AccountStackParamList, 'Confidentialite'>;

/**
 * Privacy preferences — Parcours Client §10's second half: "Offrir les
 * préférences de confidentialité, le contact du responsable des données et
 * les demandes de correction ou suppression."
 *
 * What was accepted, and when, is read from the account's consent history; the
 * server's stamped copy is the one that counts, so each line says whether it
 * has reached it. Withdrawing marketing adds a row rather than editing one.
 */
export function PrivacyScreen({ navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { account, giveConsents, requestData } = useAuth();
  const [openDoc, setOpenDoc] = useState<ConsentKind | null>(null);
  const [requestKind, setRequestKind] = useState<DataRequestKind | null>(null);
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!account) return null;
  const latest = latestConsents(account.consents);
  const isProvider = account.profiles.includes('prestataire');
  const docs: LegalDocument[] = [TERMS, PRIVACY, ...(isProvider ? [PROVIDER_CONTRACT] : [])];
  const marketingOn = !!latest.marketing?.granted;

  const toggleMarketing = async () => {
    setBusy(true);
    try {
      await giveConsents([{ kind: 'marketing', version: PRIVACY.version, granted: !marketingOn }]);
    } finally {
      setBusy(false);
    }
  };

  const sendRequest = async () => {
    if (!requestKind) return;
    setBusy(true);
    setStatus(null);
    const ok = await requestData(requestKind, details.trim());
    setBusy(false);
    setStatus(
      ok
        ? t('Demande reçue. 242Konnect vous répondra par e-mail.')
        : t("La demande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.")
    );
    if (ok) {
      setDetails('');
      setRequestKind(null);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('Retour')}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.title}>{t('Confidentialité')}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('Documents acceptés')}</Text>
      <View style={styles.card}>
        {docs.map((doc) => {
          const record = latest[doc.id];
          return (
            <View key={doc.id} style={styles.docBlock}>
              <Pressable
                onPress={() => setOpenDoc(openDoc === doc.id ? null : doc.id)}
                accessibilityRole="button"
                accessibilityLabel={`${t('Lire')} ${t(doc.title)}`}
                aria-expanded={openDoc === doc.id}
                style={styles.row}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>{t(doc.title)}</Text>
                  <Text style={styles.rowHint}>
                    {record?.granted
                      ? `v${record.version} · ${t('accepté le')} ${new Date(record.at).toLocaleString('fr-FR')}${
                          record.recorded ? '' : ` · ${t("en attente d'envoi")}`
                        }`
                      : t('Non accepté')}
                  </Text>
                </View>
                <Icon name="solar:alt-arrow-down-linear" size={16} color={colors.mutedForeground} />
              </Pressable>
              {openDoc === doc.id &&
                doc.sections.map((s) => (
                  <View key={s.title} style={styles.docSection}>
                    <Text style={styles.docSectionTitle}>{t(s.title)}</Text>
                    <Text style={styles.note}>{t(s.body)}</Text>
                  </View>
                ))}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{t('Préférences')}</Text>
      <View style={styles.card}>
        <Pressable
          onPress={toggleMarketing}
          disabled={busy}
          accessibilityRole="switch"
          accessibilityLabel={t('Communications marketing')}
          aria-checked={marketingOn} aria-disabled={busy}
          style={styles.row}
        >
          <View style={styles.rowBody}>
            <Text style={styles.rowLabel}>{t('Communications marketing')}</Text>
            <Text style={styles.rowHint}>{t('Optionnel. Nouveautés et offres de 242Konnect.')}</Text>
          </View>
          <View style={[styles.switch, marketingOn && styles.switchOn]}>
            <View style={[styles.knob, marketingOn && styles.knobOn]} />
          </View>
        </Pressable>
        <Text style={styles.note}>{t("L'application conserve votre session et vos préférences sur cet appareil. Aucune technologie de mesure publicitaire n'est utilisée.")}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t('Vos données')}</Text>
      <View style={styles.card}>
        <Text style={styles.rowLabel}>{t('Responsable des données')}</Text>
        <Text style={styles.note}>{PRIVACY_CONTACT || t('242Konnect — le contact dédié sera publié avant le lancement.')}</Text>
        <View style={styles.requestRow}>
          {(['correction', 'deletion'] as DataRequestKind[]).map((kind) => {
            const on = requestKind === kind;
            const label = kind === 'correction' ? t('Demander une correction') : t('Demander la suppression');
            return (
              <Pressable
                key={kind}
                onPress={() => setRequestKind(on ? null : kind)}
                accessibilityRole="button"
                accessibilityLabel={label}
                aria-selected={on}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {requestKind && (
          <>
            <Field
              label={requestKind === 'correction' ? t('Ce qui doit être corrigé') : t('Motif (optionnel)')}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
              style={styles.textarea}
            />
            {requestKind === 'deletion' && (
              <Text style={styles.note}>{t('Une suppression est traitée après la clôture des missions et paiements en cours : les fonds bloqués et les litiges doivent pouvoir être justifiés.')}</Text>
            )}
            <Pressable
              onPress={sendRequest}
              disabled={busy || (requestKind === 'correction' && !details.trim())}
              accessibilityRole="button"
              accessibilityLabel={t('Envoyer la demande')}
              style={[styles.solid, (busy || (requestKind === 'correction' && !details.trim())) && styles.dim]}
            >
              <Text style={styles.solidLabel}>{t('Envoyer la demande')}</Text>
            </Pressable>
          </>
        )}
        {!!status && <Text style={styles.status}>{status}</Text>}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 140, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    marginTop: 6,
  },
  card: {
    padding: 14,
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
  },
  docBlock: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  rowHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  docSection: { paddingVertical: 4, gap: 2 },
  docSectionTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.foreground },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
    padding: 3,
  },
  switchOn: { backgroundColor: colors.accent },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.card },
  knobOn: { transform: [{ translateX: 18 }] },
  requestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  chipLabelOn: { color: colors.accentForeground },
  textarea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  solid: {
    height: 46,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solidLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primaryForeground },
  dim: { opacity: 0.5 },
  status: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
});
