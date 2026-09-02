import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pickAvatar } from '../photo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/Avatar';
import { Field, FormError, PhoneField, SubmitButton } from '../components/form';
import { Sheet } from '../components/Sheet';
import {
  ageFrom,
  BUSINESS_SECTORS,
  INTERESTS,
  isValidEmail,
  MIN_PRESTATAIRE_AGE,
  normalizePhone,
  PROFILE_LABELS,
  useAuth,
  type OtpChannel,
  type ProfileKind,
} from '../auth';
import { trades } from '../data';
import type { IconName } from '../icons';
import type { AuthStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Inscription'>;

/**
 * Account creation, in three shapes.
 *
 * §2.2 asks for a different set of information from each account type, so this
 * is not one form with a few conditional rows: a prestataire must supply a
 * photo, a date of birth and proof of competence, a business supplies its RCCM
 * and NIF, and a particulier supplies where they live and how to find it.
 * Making them share a form would either over-ask the particulier or under-ask
 * the business.
 *
 * The steps are: choose the type → identity → the type's own details → the code.
 * Verification is the same for all three and lives on its own screen.
 */

const PROFILES: { id: ProfileKind; hint: string; icon: IconName }[] = [
  { id: 'particulier', hint: 'Je cherche un service', icon: 'solar:user-rounded-linear' },
  { id: 'prestataire', hint: 'Je propose mes compétences', icon: 'mdi:wrench' },
  { id: 'business', hint: 'Pour mon entreprise', icon: '242k:briefcase' },
];

const CHANNELS: { id: OtpChannel; label: string }[] = [
  { id: 'email', label: 'E-mail' },
  { id: 'sms', label: 'SMS' },
];

type Step = 'type' | 'identity' | 'details';

export function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { startSignUp } = useAuth();

  const [step, setStep] = useState<Step>('type');
  const [profile, setProfile] = useState<ProfileKind>('particulier');
  const [channel, setChannel] = useState<OtpChannel>('email');

  // Identity, common to all three.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState<string | undefined>();

  // Particulier.
  const [address, setAddress] = useState('');
  const [addressReference, setAddressReference] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  // Prestataire.
  const [birthDate, setBirthDate] = useState('');
  const [tradeId, setTradeId] = useState('');
  const [zone, setZone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [bio, setBio] = useState('');
  const [formations, setFormations] = useState('');
  const [diplomas, setDiplomas] = useState('');
  const [experience, setExperience] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [showTrades, setShowTrades] = useState(false);

  // Business.
  const [companyName, setCompanyName] = useState('');
  const [rccm, setRccm] = useState('');
  const [nif, setNif] = useState('');
  const [sector, setSector] = useState('');
  const [website, setWebsite] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [logo, setLogo] = useState<string | undefined>();
  const [showSectors, setShowSectors] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resized and compressed before it is ever held in memory as base64 — see
   * `photo.ts`. Encoding the picker's original filled the device's storage.
   */
  const pickImage = async (onPicked: (uri: string) => void) => {
    setError(null);
    try {
      const next = await pickAvatar();
      if (next) onPicked(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'utiliser cette image.");
    }
  };

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const identityReady =
    name.trim().length >= 2 &&
    normalizePhone(phone).length === 9 &&
    isValidEmail(email) &&
    password.length >= 6 &&
    // Only the prestataire is required to supply a photo (§2.2).
    (profile !== 'prestataire' || !!avatar);

  const detailsReady =
    profile === 'particulier'
      ? address.trim().length > 0 && addressReference.trim().length > 0
      : profile === 'prestataire'
        ? !!birthDate && !!tradeId && zone.trim().length > 0 && Number(hourlyRate) > 0 && bio.trim().length > 0
        : companyName.trim().length > 0 &&
          rccm.trim().length > 0 &&
          nif.trim().length > 0 &&
          sector.length > 0 &&
          companyAddress.trim().length > 0;

  const age = birthDate ? ageFrom(birthDate) : null;
  const tooYoung = age !== null && age < MIN_PRESTATAIRE_AGE;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await startSignUp({
        name,
        phone,
        email,
        password,
        profile,
        channel,
        avatar,
        bio: profile === 'prestataire' ? bio : undefined,
        particulier:
          profile === 'particulier' ? { address, addressReference, interests } : undefined,
        prestataire:
          profile === 'prestataire'
            ? {
                birthDate,
                tradeId,
                zone,
                hourlyRate: Number(hourlyRate),
                formations,
                diplomas,
                experience,
                documents,
                // Never self-set: 242Konnect awards it after checking documents.
                verified: false,
              }
            : undefined,
        business:
          profile === 'business'
            ? { companyName, logo, rccm, nif, sector, website, address: companyAddress }
            : undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de créer le compte.');
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setError(null);
    if (step === 'details') setStep('identity');
    else if (step === 'identity') setStep('type');
    else navigation.goBack();
  };

  const STEP_INDEX: Record<Step, number> = { type: 0, identity: 1, details: 2 };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        {/* Three steps, so the progress is worth showing — it tells someone
            filling a long prestataire form that it does end. */}
        <View style={styles.progress} accessibilityLabel={`Étape ${STEP_INDEX[step] + 1} sur 3`}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.progressBar, i <= STEP_INDEX[step] && styles.progressBarOn]} />
          ))}
        </View>

        {step === 'type' && (
          <>
            <Text style={styles.title}>Quel type de compte ?</Text>
            <Text style={styles.lede}>
              Les informations demandées changent selon le type. Un seul compte suffit : vous
              pourrez activer les autres profils plus tard, avec le même identifiant.
            </Text>

            <View style={styles.typeList}>
              {PROFILES.map((option) => {
                const selected = profile === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => setProfile(option.id)}
                    accessibilityRole="radio"
                    accessibilityLabel={PROFILE_LABELS[option.id]}
                    accessibilityState={{ selected }}
                    style={[styles.type, selected && styles.typeSelected]}
                  >
                    <Icon
                      name={option.icon}
                      size={24}
                      color={selected ? colors.accentForeground : colors.mutedForeground}
                    />
                    <View style={styles.typeBody}>
                      <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                        {PROFILE_LABELS[option.id]}
                      </Text>
                      <Text style={[styles.typeHint, selected && styles.typeHintSelected]}>
                        {option.hint}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.requires}>
              <Text style={styles.requiresTitle}>Ce compte demande</Text>
              {(profile === 'particulier'
                ? ['Nom, téléphone et e-mail', 'Adresse complète et un repère pour vous trouver', 'Vos centres d’intérêt (optionnel)']
                : profile === 'prestataire'
                  ? ['Une photo de profil (obligatoire)', `Votre date de naissance — ${MIN_PRESTATAIRE_AGE} ans minimum`, 'Votre métier, votre zone et votre tarif', 'Formations, diplômes et pièces justificatives']
                  : ['Raison sociale et logo', 'RCCM et NIF', 'Secteur d’activité et adresse', 'Site web (optionnel)']
              ).map((line) => (
                <View key={line} style={styles.requireRow}>
                  <View style={styles.requireDot} />
                  <Text style={styles.requireText}>{line}</Text>
                </View>
              ))}
            </View>

            <SubmitButton label="Continuer" onPress={() => setStep('identity')} accessibilityLabel="Continuer" />
          </>
        )}

        {step === 'identity' && (
          <>
            <Text style={styles.title}>Vos identifiants</Text>
            <Text style={styles.lede}>
              Compte {PROFILE_LABELS[profile].toLowerCase()}. Votre numéro et votre e-mail
              identifient le compte et ne peuvent pas servir deux fois.
            </Text>

            <View style={styles.photoBlock}>
              <UserAvatar name={name || '?'} avatar={avatar} size={84} border={colors.border} />
              <Pressable
                onPress={() => pickImage(setAvatar)}
                accessibilityRole="button"
                accessibilityLabel="Ajouter une photo de profil"
                style={styles.photoButton}
              >
                <Icon name="solar:add-square-bold" size={18} color={colors.foreground} />
                <Text style={styles.photoButtonLabel}>
                  {avatar ? 'Changer la photo' : 'Ajouter une photo'}
                </Text>
              </Pressable>
              {profile === 'prestataire' && !avatar && (
                <Text style={styles.photoRequired}>Obligatoire pour un prestataire.</Text>
              )}
            </View>

            <View style={styles.form}>
              <Field
                label={profile === 'business' ? 'Nom du responsable' : 'Nom complet'}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <PhoneField value={phone} onChangeText={(v) => setPhone(normalizePhone(v))} />
              <Field
                label={profile === 'business' ? 'E-mail professionnel' : 'Adresse e-mail'}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                inputMode="email"
                placeholder="vous@exemple.com"
              />
              <Field
                label="Mot de passe"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="6 caractères minimum"
              />

              <View style={styles.channel}>
                <Text style={styles.sectionLabel}>Recevoir le code de vérification par</Text>
                <View style={styles.channelRow}>
                  {CHANNELS.map((option) => {
                    const selected = channel === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => setChannel(option.id)}
                        accessibilityRole="radio"
                        accessibilityLabel={`Recevoir le code par ${option.label}`}
                        accessibilityState={{ selected }}
                        style={[styles.channelChip, selected && styles.channelChipSelected]}
                      >
                        <Text style={[styles.channelLabel, selected && styles.channelLabelSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <FormError message={error} />
              <SubmitButton
                label="Continuer"
                onPress={() => {
                  setError(null);
                  setStep('details');
                }}
                disabled={!identityReady}
                accessibilityLabel="Continuer vers les informations"
              />
            </View>
          </>
        )}

        {step === 'details' && (
          <View style={styles.form}>
            {profile === 'particulier' && (
              <>
                <Text style={styles.title}>Où intervenir ?</Text>
                <Text style={styles.lede}>
                  Les prestataires en ont besoin pour venir chez vous.
                </Text>
                <Field
                  label="Adresse complète"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Quartier, avenue, numéro"
                />
                <Field
                  label="Référence de l'adresse"
                  value={addressReference}
                  onChangeText={setAddressReference}
                  placeholder="Près de quel repère ? (école, marché, station)"
                />
                <View>
                  <Text style={styles.sectionLabel}>Centres d'intérêt (optionnel)</Text>
                  <View style={styles.chips}>
                    {INTERESTS.map((item) => {
                      const on = interests.includes(item);
                      return (
                        <Pressable
                          key={item}
                          onPress={() => toggle(interests, item, setInterests)}
                          accessibilityRole="button"
                          accessibilityLabel={`Centre d'intérêt ${item}`}
                          accessibilityState={{ selected: on }}
                          style={[styles.chip, on && styles.chipOn]}
                        >
                          <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{item}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            )}

            {profile === 'prestataire' && (
              <>
                <Text style={styles.title}>Votre activité</Text>
                <Text style={styles.lede}>
                  Ces informations sont vérifiées par 242Konnect avant l'attribution du badge
                  « Prestataire vérifié ».
                </Text>

                <Field
                  label="Date de naissance"
                  value={birthDate}
                  onChangeText={setBirthDate}
                  placeholder="AAAA-MM-JJ"
                  error={tooYoung ? `Réservé aux ${MIN_PRESTATAIRE_AGE} ans et plus.` : undefined}
                />

                <View style={styles.field}>
                  <Text style={styles.sectionLabel}>Métier</Text>
                  <Pressable
                    onPress={() => setShowTrades(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Choisir votre métier"
                    style={styles.select}
                  >
                    <Text style={[styles.selectValue, !tradeId && styles.selectPlaceholder]}>
                      {trades.find((t) => t.id === tradeId)?.label ?? 'Choisir un métier'}
                    </Text>
                    <Icon name="solar:alt-arrow-down-linear" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>

                <Field
                  label="Zone d'intervention"
                  value={zone}
                  onChangeText={setZone}
                  placeholder="Quartiers ou communes couverts"
                />
                <Field
                  label="Tarif horaire (FCFA)"
                  value={hourlyRate}
                  onChangeText={(v) => setHourlyRate(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="15000"
                />
                <Field
                  label="Biographie"
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Votre expérience et ce que vous proposez"
                  multiline
                  numberOfLines={4}
                  style={styles.textarea}
                />
                <Field
                  label="Formations (optionnel)"
                  value={formations}
                  onChangeText={setFormations}
                  placeholder="Écoles, centres de formation"
                />
                <Field
                  label="Diplômes et certificats (optionnel)"
                  value={diplomas}
                  onChangeText={setDiplomas}
                  placeholder="CAP, BTS, certifications"
                />
                <Field
                  label="Expériences professionnelles (optionnel)"
                  value={experience}
                  onChangeText={setExperience}
                  placeholder="Employeurs, chantiers, années"
                  multiline
                  numberOfLines={3}
                  style={styles.textarea}
                />

                <View style={styles.field}>
                  <Text style={styles.sectionLabel}>Pièces justificatives</Text>
                  <Text style={styles.hint}>
                    Pièce d'identité, attestation, certificat. Vérifiées par 242Konnect.
                  </Text>
                  {documents.map((doc, i) => (
                    <View key={`${doc}-${i}`} style={styles.docRow}>
                      <Icon name="242k:briefcase" size={16} color={colors.mutedForeground} />
                      <Text style={styles.docName} numberOfLines={1}>
                        Document {i + 1}
                      </Text>
                      <Pressable
                        onPress={() => setDocuments(documents.filter((_, j) => j !== i))}
                        accessibilityRole="button"
                        accessibilityLabel={`Retirer le document ${i + 1}`}
                      >
                        <Text style={styles.docRemove}>Retirer</Text>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    onPress={() => pickImage((uri) => setDocuments((prev) => [...prev, uri]))}
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter une pièce justificative"
                    style={styles.addDoc}
                  >
                    <Icon name="solar:add-square-bold" size={18} color={colors.foreground} />
                    <Text style={styles.addDocLabel}>Ajouter une pièce</Text>
                  </Pressable>
                </View>
              </>
            )}

            {profile === 'business' && (
              <>
                <Text style={styles.title}>Votre entreprise</Text>
                <Text style={styles.lede}>
                  Les documents légaux sont vérifiés par 242Konnect avant validation du compte.
                </Text>

                <View style={styles.photoBlock}>
                  <UserAvatar name={companyName || '?'} avatar={logo} size={72} border={colors.border} />
                  <Pressable
                    onPress={() => pickImage(setLogo)}
                    accessibilityRole="button"
                    accessibilityLabel="Ajouter le logo"
                    style={styles.photoButton}
                  >
                    <Icon name="solar:add-square-bold" size={18} color={colors.foreground} />
                    <Text style={styles.photoButtonLabel}>{logo ? 'Changer le logo' : 'Ajouter le logo'}</Text>
                  </Pressable>
                </View>

                <Field label="Raison sociale" value={companyName} onChangeText={setCompanyName} />
                <Field label="RCCM" value={rccm} onChangeText={setRccm} placeholder="CG-PNR-01-2026-B12-00001" />
                <Field label="NIF" value={nif} onChangeText={setNif} placeholder="Numéro d'identification fiscale" />

                <View style={styles.field}>
                  <Text style={styles.sectionLabel}>Secteur d'activité</Text>
                  <Pressable
                    onPress={() => setShowSectors(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Choisir le secteur d'activité"
                    style={styles.select}
                  >
                    <Text style={[styles.selectValue, !sector && styles.selectPlaceholder]}>
                      {sector || 'Choisir un secteur'}
                    </Text>
                    <Icon name="solar:alt-arrow-down-linear" size={18} color={colors.mutedForeground} />
                  </Pressable>
                </View>

                <Field
                  label="Adresse de l'entreprise"
                  value={companyAddress}
                  onChangeText={setCompanyAddress}
                  placeholder="Quartier, avenue, numéro"
                />
                <Field
                  label="Site web (optionnel)"
                  value={website}
                  onChangeText={setWebsite}
                  autoCapitalize="none"
                  placeholder="https://"
                />
              </>
            )}

            <FormError message={error} />
            <SubmitButton
              label="Créer mon compte"
              onPress={submit}
              busy={busy}
              disabled={!detailsReady || tooYoung}
              accessibilityLabel="Créer mon compte"
            />
          </View>
        )}

        {step === 'type' && (
          <Pressable
            onPress={() => navigation.navigate('Connexion')}
            accessibilityRole="button"
            accessibilityLabel="J'ai déjà un compte, se connecter"
            style={styles.altRow}
          >
            <Text style={styles.altText}>
              J'ai déjà un compte · <Text style={styles.altLink}>Se connecter</Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <Sheet visible={showTrades} title="Votre métier" onClose={() => setShowTrades(false)}>
        {trades.map((trade) => (
          <Pressable
            key={trade.id}
            onPress={() => {
              setTradeId(trade.id);
              setShowTrades(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={trade.label}
            accessibilityState={{ selected: trade.id === tradeId }}
            style={[styles.sheetRow, trade.id === tradeId && styles.sheetRowOn]}
          >
            <Text style={styles.sheetRowLabel}>{trade.label}</Text>
            <Text style={styles.sheetRowHint} numberOfLines={2}>
              {trade.description}
            </Text>
          </Pressable>
        ))}
      </Sheet>

      <Sheet visible={showSectors} title="Secteur d'activité" onClose={() => setShowSectors(false)}>
        {BUSINESS_SECTORS.map((item) => (
          <Pressable
            key={item}
            onPress={() => {
              setSector(item);
              setShowSectors(false);
            }}
            accessibilityRole="button"
            accessibilityLabel={item}
            accessibilityState={{ selected: item === sector }}
            style={[styles.sheetRow, item === sector && styles.sheetRowOn]}
          >
            <Text style={styles.sheetRowLabel}>{item}</Text>
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
  progress: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  progressBarOn: { backgroundColor: colors.accent },
  title: { fontFamily: fonts.heading, fontSize: 26, color: colors.foreground },
  lede: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.mutedForeground },
  sectionLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground, marginBottom: 6 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginBottom: 8 },

  typeList: { gap: 10 },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  typeBody: { flex: 1 },
  typeLabel: { fontFamily: fonts.sansSemibold, fontSize: 15, color: colors.foreground },
  typeLabelSelected: { color: colors.accentForeground },
  typeHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  typeHintSelected: { color: 'rgba(10,10,10,0.7)' },

  requires: {
    padding: 14,
    gap: 6,
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
  requireRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requireDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground },
  requireText: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.foreground },

  photoBlock: { alignItems: 'center', gap: 10 },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  photoButtonLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  photoRequired: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.warning },

  form: { gap: 14 },
  field: { gap: 2 },
  textarea: { height: 92, paddingTop: 14, textAlignVertical: 'top' },
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
  selectPlaceholder: { color: colors.mutedForeground },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  docName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  docRemove: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.destructive },
  addDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    marginTop: 10,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  addDocLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },

  channel: { gap: 2 },
  channelRow: { flexDirection: 'row', gap: 8 },
  channelChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  channelChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  channelLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  channelLabelSelected: { color: colors.accentForeground },

  sheetRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 2,
  },
  sheetRowOn: { borderColor: colors.accent, backgroundColor: colors.muted },
  sheetRowLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  sheetRowHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },

  altRow: { alignItems: 'center', paddingVertical: 4 },
  altText: { fontFamily: fonts.sans, fontSize: 14, color: colors.mutedForeground },
  altLink: { fontFamily: fonts.sansBold, color: colors.foreground },
});
