import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { Field, FormError, SubmitButton } from '../components/form';
import { useAuth } from '../auth';
import { needsReacceptance, PRIVACY, PROVIDER_CONTRACT, TERMS, type LegalDocument } from '../consent';
import { colors, fonts, radius } from '../theme';
import { useT } from '../i18n';

/**
 * Stands between a signed-in account and the app when a mandatory document has
 * not been accepted in its current version.
 *
 * Two cases reach it: accounts created before consent was recorded at all, and
 * every account after a document's version constant is bumped — Prestataire
 * §06, "une nouvelle version importante doit être acceptée à nouveau".
 */
export function ConsentGateScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { account, giveConsents, signOut } = useAuth();
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [signature, setSignature] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;
  const isProvider = account.profiles.includes('prestataire');
  const owed = needsReacceptance(account.consents, isProvider);
  const docs = [TERMS, PRIVACY, PROVIDER_CONTRACT].filter((d) =>
    owed.includes(d.id as (typeof owed)[number])
  ) as LegalDocument[];
  const needsSignature = owed.includes('provider_contract');
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
  const ready =
    docs.every((d) => accepted[d.id]) && (!needsSignature || norm(signature) === norm(account.name));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await giveConsents(
        docs.map((d) => ({
          kind: d.id,
          version: d.version,
          granted: true,
          ...(d.id === 'provider_contract' ? { signature: signature.trim() } : {}),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
    >
      <Text style={styles.title}>{t('Mise à jour des conditions')}</Text>
      <Text style={styles.lede}>{t("Pour continuer, lisez et acceptez la version actuelle des documents ci-dessous. La date, l'heure et la version sont enregistrées.")}</Text>

      {docs.map((doc) => (
        <View key={doc.id} style={styles.card}>
          <Pressable
            onPress={() => setOpened((o) => ({ ...o, [doc.id]: !o[doc.id] }))}
            accessibilityRole="button"
            accessibilityLabel={`${t('Lire')} ${t(doc.title)}`}
            style={styles.head}
          >
            <Text style={styles.docTitle}>{t(doc.title)}</Text>
            <Text style={styles.version}>v{doc.version}</Text>
          </Pressable>
          {opened[doc.id] &&
            doc.sections.map((s) => (
              <View key={s.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{t(s.title)}</Text>
                <Text style={styles.sectionBody}>{t(s.body)}</Text>
              </View>
            ))}
          <Pressable
            onPress={() => setAccepted((a) => ({ ...a, [doc.id]: !a[doc.id] }))}
            disabled={doc.id === 'provider_contract' && !opened[doc.id]}
            accessibilityRole="checkbox"
            accessibilityLabel={`${t("J'accepte")} ${t(doc.title)}`}
            aria-checked={!!accepted[doc.id]}
            style={[styles.checkRow, doc.id === 'provider_contract' && !opened[doc.id] && styles.dim]}
          >
            <View style={[styles.box, accepted[doc.id] && styles.boxOn]}>
              {accepted[doc.id] && <Icon name="242k:check" size={14} color={colors.accentForeground} />}
            </View>
            <Text style={styles.checkLabel}>
              {t("J'accepte")} — {t(doc.title)}
            </Text>
          </Pressable>
        </View>
      ))}

      {needsSignature && (
        <Field
          label={t('Signature : votre nom complet')}
          value={signature}
          onChangeText={setSignature}
          autoCapitalize="words"
          placeholder={account.name}
        />
      )}

      <FormError message={error} />
      <SubmitButton
        label={t('Accepter et continuer')}
        onPress={submit}
        busy={busy}
        disabled={!ready}
        accessibilityLabel={t('Accepter et continuer')}
      />
      <Pressable onPress={signOut} accessibilityRole="button" accessibilityLabel={t('Se déconnecter')} style={styles.signOut}>
        <Text style={styles.signOutLabel}>{t('Se déconnecter')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 24, gap: 14 },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.foreground },
  lede: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  docTitle: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  version: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  section: { paddingBottom: 8, gap: 2 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.foreground },
  sectionBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dim: { opacity: 0.5 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14, color: colors.foreground },
  signOut: { alignItems: 'center', paddingVertical: 10 },
  signOutLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.mutedForeground },
});
