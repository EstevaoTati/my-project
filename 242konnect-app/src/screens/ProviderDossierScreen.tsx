import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/Avatar';
import { Field, FormError, SubmitButton } from '../components/form';
import { PricingEditor } from '../components/PricingEditor';
import { Sheet } from '../components/Sheet';
import { ageFrom, MAX_DOCUMENTS, MIN_PRESTATAIRE_AGE, useAuth } from '../auth';
import { PROVIDER_CONTRACT } from '../consent';
import { trades } from '../data';
import { pickAvatar } from '../photo';
import { currencyFor, pricingProblem, type PricingModel, type ProjectDuration } from '../pricing';
import type { AccountStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = NativeStackScreenProps<AccountStackParamList, 'DossierPrestataire'>;

/**
 * "Offer your services" from an account that already exists.
 *
 * Client §14: the request "crée un dossier Prestataire séparé à vérifier, sans
 * désactiver le profil Client". Prestataire §01: "Bloquer toute activation
 * automatique et afficher les pièces nécessaires avant de continuer."
 *
 * This used to be a chip that switched the profile on in one tap and left an
 * empty prestataire record behind. It is now the same dossier a prestataire
 * fills at sign-up — trade, zone, pricing, durations, documents — ending in the
 * contract, and it submits for review rather than activating anything bookable.
 */
export function ProviderDossierScreen({ navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { account, submitProviderDossier } = useAuth();

  const [avatar, setAvatar] = useState(account?.avatar);
  const [birthDate, setBirthDate] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [zone, setZone] = useState('');
  const [priceModel, setPriceModel] = useState<PricingModel | null>(null);
  const [priceAmount, setPriceAmount] = useState('');
  const [negotiable, setNegotiable] = useState(false);
  const [durations, setDurations] = useState<ProjectDuration[]>([]);
  const [bio, setBio] = useState(account?.bio ?? '');
  const [experience, setExperience] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [contractOpen, setContractOpen] = useState(false);
  const [contractRead, setContractRead] = useState(false);
  const [accept, setAccept] = useState(false);
  const [signature, setSignature] = useState('');
  const [showTrades, setShowTrades] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;
  const currency = currencyFor(account.location.country);
  const pricing = priceModel
    ? {
        model: priceModel,
        amount: priceModel === 'quote' ? undefined : Number(priceAmount) || undefined,
        negotiable,
        currency,
      }
    : undefined;
  const age = birthDate ? ageFrom(birthDate) : null;
  const tooYoung = age !== null && age < MIN_PRESTATAIRE_AGE;
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
  const signatureMatches = norm(signature) === norm(account.name);
  const ready =
    !!avatar &&
    !!birthDate &&
    !tooYoung &&
    !!tradeId &&
    !!zone.trim() &&
    !pricingProblem(pricing) &&
    durations.length > 0 &&
    !!bio.trim() &&
    contractRead &&
    accept &&
    signatureMatches;

  const pick = async (onPicked: (uri: string) => void) => {
    setError(null);
    try {
      const next = await pickAvatar();
      if (next) onPicked(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'utiliser cette image.");
    }
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await submitProviderDossier({
        details: {
          birthDate,
          tradeId,
          zone: zone.trim(),
          hourlyRate: pricing?.model === 'hourly' ? pricing.amount ?? 0 : 0,
          pricing,
          durations,
          formations: '',
          diplomas: '',
          experience,
          documents,
        },
        bio,
        avatar,
        signature,
      });
      navigation.replace('EspacePrestataire');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le dossier n'a pas pu être envoyé.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('Retour')}
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={styles.title}>{t('Offrir mes services')}</Text>
        <Text style={styles.lede}>{t("Un dossier Prestataire séparé, vérifié par 242Konnect. Votre profil Client reste actif et inchangé ; le profil Prestataire n'est réservable qu'après approbation.")}</Text>

        <View style={styles.requires}>
          <Text style={styles.requiresTitle}>{t('Pièces nécessaires')}</Text>
          {[
            t('Une photo de profil (obligatoire)'),
            t('Votre date de naissance — 16 ans minimum'),
            t('Votre métier, votre zone, votre modèle de prix et vos durées'),
            t("Jusqu'à cinq pièces justificatives"),
            t('La signature du contrat Prestataire'),
          ].map((line) => (
            <Text key={line} style={styles.requireText}>· {line}</Text>
          ))}
        </View>

        <View style={styles.photoBlock}>
          <UserAvatar name={account.name} avatar={avatar} size={72} border={colors.border} />
          <Pressable
            onPress={() => pick(setAvatar)}
            accessibilityRole="button"
            accessibilityLabel={t('Ajouter une photo de profil')}
            style={styles.pill}
          >
            <Text style={styles.pillLabel}>{avatar ? t('Changer la photo') : t('Ajouter une photo')}</Text>
          </Pressable>
        </View>

        <Field
          label={t('Date de naissance')}
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder={t('AAAA-MM-JJ')}
          autoCapitalize="none"
          error={tooYoung ? t('Réservé aux 16 ans et plus.') : undefined}
        />

        <View>
          <Text style={styles.label}>{t('Métier')}</Text>
          <Pressable
            onPress={() => setShowTrades(true)}
            accessibilityRole="button"
            accessibilityLabel={t('Choisir votre métier')}
            style={styles.select}
          >
            <Text style={[styles.selectValue, !tradeId && styles.placeholder]}>
              {trades.find((x) => x.id === tradeId)?.label ?? t('Choisir un métier')}
            </Text>
            <Icon name="solar:alt-arrow-down-linear" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Field
          label={t("Zone d'intervention")}
          value={zone}
          onChangeText={setZone}
          placeholder={t('Quartiers ou communes couverts')}
        />

        <PricingEditor
          currency={currency}
          model={priceModel}
          onModel={setPriceModel}
          amount={priceAmount}
          onAmount={setPriceAmount}
          negotiable={negotiable}
          onNegotiable={setNegotiable}
          durations={durations}
          onDurations={setDurations}
        />

        <Field
          label={t('Biographie')}
          value={bio}
          onChangeText={setBio}
          placeholder={t('Votre expérience et ce que vous proposez')}
          multiline
          numberOfLines={4}
          style={styles.textarea}
        />
        <Field
          label={t('Expériences professionnelles (optionnel)')}
          value={experience}
          onChangeText={setExperience}
          placeholder={t('Employeurs, chantiers, années')}
        />

        <View>
          <Text style={styles.label}>
            {t('Pièces justificatives')} · {documents.length}/{MAX_DOCUMENTS}
          </Text>
          {documents.map((_, i) => (
            <View key={i} style={styles.docRow}>
              <Text style={styles.docName}>Document {i + 1}</Text>
              <Text style={styles.docStatus}>{t('Reçu')}</Text>
              <Pressable
                onPress={() => setDocuments(documents.filter((__, j) => j !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Retirer le document ${i + 1}`}
              >
                <Text style={styles.remove}>{t('Retirer')}</Text>
              </Pressable>
            </View>
          ))}
          {documents.length < MAX_DOCUMENTS && (
            <Pressable
              onPress={() => pick((uri) => setDocuments((prev) => (prev.length < MAX_DOCUMENTS ? [...prev, uri] : prev)))}
              accessibilityRole="button"
              accessibilityLabel={t('Ajouter une pièce justificative')}
              style={styles.addDoc}
            >
              <Text style={styles.pillLabel}>{t('Ajouter une pièce')}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.contract}>
          <Pressable
            onPress={() => {
              setContractOpen((v) => !v);
              setContractRead(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('Lire')} ${t(PROVIDER_CONTRACT.title)}`}
            aria-expanded={contractOpen}
            style={styles.contractHead}
          >
            <Text style={styles.contractTitle}>{t(PROVIDER_CONTRACT.title)}</Text>
            <Text style={styles.version}>v{PROVIDER_CONTRACT.version}</Text>
          </Pressable>
          {contractOpen &&
            PROVIDER_CONTRACT.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{t(section.title)}</Text>
                <Text style={styles.sectionBody}>{t(section.body)}</Text>
              </View>
            ))}
        </View>
        <Pressable
          onPress={() => setAccept((v) => !v)}
          disabled={!contractRead}
          accessibilityRole="checkbox"
          accessibilityLabel={t("J'ai lu et j'accepte le contrat Prestataire")}
          aria-checked={accept} aria-disabled={!contractRead}
          style={[styles.checkRow, !contractRead && styles.disabled]}
        >
          <View style={[styles.box, accept && styles.boxOn]}>
            {accept && <Icon name="242k:check" size={14} color={colors.accentForeground} />}
          </View>
          <Text style={styles.checkLabel}>{t("J'ai lu et j'accepte le contrat Prestataire")}</Text>
        </Pressable>
        <Field
          label={t('Signature : votre nom complet')}
          value={signature}
          onChangeText={setSignature}
          autoCapitalize="words"
          placeholder={account.name}
          error={signature.trim() && !signatureMatches ? t('La signature doit reprendre votre nom complet.') : undefined}
        />

        <FormError message={error} />
        <SubmitButton
          label={t('Envoyer le dossier')}
          onPress={submit}
          busy={busy}
          disabled={!ready}
          accessibilityLabel={t('Envoyer le dossier')}
        />
      </ScrollView>

      <Sheet visible={showTrades} title={t('Votre métier')} onClose={() => setShowTrades(false)}>
        {trades.map((trade) => (
          <Pressable
            key={trade.id}
            onPress={() => {
              setTradeId(trade.id);
              setShowTrades(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={trade.label}
            aria-selected={trade.id === tradeId}
            style={[styles.sheetRow, trade.id === tradeId && styles.sheetRowOn]}
          >
            <Text style={styles.sheetLabel}>{trade.label}</Text>
          </Pressable>
        ))}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 24, gap: 14 },
  back: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.foreground },
  lede: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  requires: {
    padding: 14,
    gap: 4,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requiresTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  requireText: { fontFamily: fonts.sans, fontSize: 13, color: colors.foreground },
  photoBlock: { alignItems: 'center', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pillLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground, marginBottom: 6 },
  select: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  placeholder: { color: colors.mutedForeground },
  textarea: { height: 92, paddingTop: 14, textAlignVertical: 'top' },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  docName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  docStatus: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.mutedForeground,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  remove: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.destructive },
  addDoc: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    marginTop: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  contract: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
  },
  contractHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  contractTitle: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  version: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  section: { paddingBottom: 10, gap: 2 },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.foreground },
  sectionBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  disabled: { opacity: 0.5 },
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
  sheetRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  sheetRowOn: { borderColor: colors.accent, backgroundColor: colors.muted },
  sheetLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
});
