import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/Avatar';
import { Sheet } from '../components/Sheet';
import { useAuth } from '../auth';
import { getTrade } from '../data';
import { createRequest, getListing, type Listing } from '../marketplace';
import { bookableAmount, describePricing, DURATIONS as PROVIDER_DURATIONS, formatAmount } from '../pricing';
import { LONG_DURATIONS, type MissionDuration } from '../store';
import type { HomeStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { T, useT } from '../i18n';

type Props = NativeStackScreenProps<HomeStackParamList, 'Inscrit'>;

const SLOTS = [T('Dès que possible'), "Aujourd'hui, 14h00", "Aujourd'hui, 16h30", 'Demain, 09h00', 'Demain, 11h00'];

const DURATIONS: { id: MissionDuration; label: string }[] = [
  { id: 'hours', label: T('Quelques heures') },
  { id: 'days', label: T('Quelques jours') },
  { id: 'weeks', label: T('Quelques semaines') },
  { id: 'months', label: T('Plusieurs mois') },
  { id: 'recurring', label: T('Service récurrent') },
];

/**
 * A prestataire who signed up on 242Konnect, and the way to send them a request.
 *
 * Client §13: identity, badge, prices, experience — never the phone or e-mail;
 * contact goes through the request and its chat. Prestataire §07: a pending
 * profile is shown, with its badge, and cannot be booked. The request is
 * created as a draft; it reaches the prestataire only once paid (Commande §07),
 * which happens on the Missions tab.
 */
export function ListingScreen({ route, navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { account, marketSession } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const savedAddress = account?.particulier
    ? `${account.particulier.address}${account.particulier.addressReference ? ` (${account.particulier.addressReference})` : ''}`
    : '';
  const [useSaved, setUseSaved] = useState(!!savedAddress);
  const [otherAddress, setOtherAddress] = useState('');
  const [slot, setSlot] = useState<string | null>(null);
  const [duration, setDuration] = useState<MissionDuration>('hours');
  const [contract, setContract] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await marketSession();
      if (!session) {
        setLoadError(t('Connectez-vous à nouveau pour voir ce prestataire.'));
        return;
      }
      try {
        setListing(await getListing(session, route.params.id));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : null);
      }
    })();
  }, [route.params.id, marketSession, t]);

  const amount = bookableAmount(listing?.pricing);
  const currency = listing?.pricing?.currency ?? 'FCFA';
  const approved = listing?.status === 'approved';
  const self = !!account?.supabaseUserId && listing?.id === account.supabaseUserId;
  const address = useSaved && savedAddress ? savedAddress : otherAddress.trim();
  const long = LONG_DURATIONS.includes(duration);
  const ready = !!slot && address.length >= 3 && (!long || contract) && amount > 0;

  const submit = async () => {
    if (!listing || !slot) return;
    setBusy(true);
    setError(null);
    try {
      const session = await marketSession();
      if (!session) throw new Error(t('Votre session a expiré. Reconnectez-vous.'));
      await createRequest(session, {
        providerId: listing.id,
        description: description.trim(),
        // The quarter, never the door: this is all the prestataire sees first.
        zoneHint: account?.location.city ?? '',
        address,
        slot,
        duration,
        contractSigned: contract,
        amount,
        currency: currency === 'USD' ? 'USD' : 'FCFA',
      });
      setCreated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Demande impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('Retour')}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        {!listing ? (
          <Text style={styles.muted}>{loadError ?? t('Chargement…')}</Text>
        ) : (
          <>
            <View style={styles.identity}>
              <UserAvatar name={listing.fullName} avatar={listing.avatar} size={72} />
              <View style={styles.identityBody}>
                <Text style={styles.name}>{listing.fullName}</Text>
                <Text style={styles.muted}>
                  {t(getTrade(listing.tradeId)?.label ?? listing.tradeId)} · {listing.zone || listing.city}
                </Text>
                <View style={[styles.badge, approved ? styles.badgeOn : styles.badgeOff]}>
                  <Text style={[styles.badgeText, approved ? styles.badgeTextOn : styles.badgeTextOff]}>
                    {approved ? t('Professionnel vérifié') : t('En examen · non réservable')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Row label={t('Tarification')} value={`${describePricing(listing.pricing, t)}${listing.pricing?.negotiable ? ` · ${t('Prix négociable')}` : ''}`} />
              <Row
                label={t('Durées acceptées')}
                value={listing.durations.map((d) => t(PROVIDER_DURATIONS.find((x) => x.id === d)?.label ?? d)).join(', ') || '—'}
              />
            </View>
            {!!listing.bio && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t('À propos')}</Text>
                <Text style={styles.bio}>{listing.bio}</Text>
              </View>
            )}
            <Text style={styles.muted}>{t('Le téléphone et l’e-mail du prestataire ne sont jamais affichés : la demande et la messagerie passent par 242Konnect.')}</Text>

            {self ? (
              <Text style={styles.muted}>{t('Ceci est votre propre profil, tel que les clients le voient.')}</Text>
            ) : !approved ? (
              <Text style={styles.muted}>{t('Ce prestataire est en cours de vérification par 242Konnect. Il pourra être réservé après approbation.')}</Text>
            ) : amount <= 0 ? (
              <Text style={styles.muted}>{t('Ce prestataire travaille sur devis. La demande de devis arrive bientôt.')}</Text>
            ) : (
              <Pressable
                onPress={() => {
                  setCreated(false);
                  setError(null);
                  setOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t('Envoyer une demande à')} ${listing.fullName}`}
                style={styles.cta}
              >
                <Text style={styles.ctaLabel}>{t('Envoyer une demande')}</Text>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <Sheet visible={open} title={created ? t('Demande préparée') : t('Votre demande')} onClose={() => setOpen(false)}>
        {created ? (
          <View style={styles.form}>
            <Text style={styles.bio}>{t("Votre demande est prête. Elle sera envoyée dès le paiement protégé : revoyez-la et payez depuis l'onglet Missions.")}</Text>
            <Pressable
              onPress={() => {
                setOpen(false);
                navigation.getParent()?.navigate('Missions' as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('Revoir et payer')}
              style={styles.cta}
            >
              <Text style={styles.ctaLabel}>{t('Revoir et payer')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder={t('Ce qui doit être fait, les détails utiles')}
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel={t('Description de la demande')}
              style={[styles.input, styles.textarea]}
            />
            <Text style={styles.label}>{t("Lieu de l'intervention")}</Text>
            <View style={styles.chips}>
              {!!savedAddress && (
                <Choice on={useSaved} label={t('Mon adresse enregistrée')} onPress={() => setUseSaved(true)} />
              )}
              <Choice on={!useSaved || !savedAddress} label={t('Une autre adresse')} onPress={() => setUseSaved(false)} />
            </View>
            {useSaved && savedAddress ? (
              <Text style={styles.muted}>{savedAddress}</Text>
            ) : (
              <TextInput
                value={otherAddress}
                onChangeText={setOtherAddress}
                placeholder={t('Quartier, avenue, numéro, repère')}
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel={t("Adresse de l'intervention")}
                style={styles.input}
              />
            )}
            <Text style={styles.muted}>{t("L'adresse exacte reste privée jusqu'à l'acceptation.")}</Text>

            <Text style={styles.label}>{t('Durée')}</Text>
            <View style={styles.chips}>
              {DURATIONS.map((d) => (
                <Choice key={d.id} on={duration === d.id} label={t(d.label)} onPress={() => setDuration(d.id)} a11y={`${t('Durée')} ${t(d.label)}`} />
              ))}
            </View>
            {long && (
              <Choice
                on={contract}
                label={t('Je signe le contrat de projet')}
                onPress={() => setContract((v) => !v)}
              />
            )}

            <Text style={styles.label}>{t('Choisissez un créneau')}</Text>
            <View style={styles.chips}>
              {SLOTS.map((s) => (
                <Choice key={s} on={slot === s} label={t(s)} onPress={() => setSlot(s)} />
              ))}
            </View>

            <Row label={t('Montant à autoriser')} value={formatAmount(amount, currency === 'USD' ? 'USD' : 'FCFA')} />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              onPress={submit}
              disabled={!ready || busy}
              accessibilityRole="button"
              accessibilityLabel={t('Préparer la demande')}
              style={[styles.cta, (!ready || busy) && styles.ctaOff]}
            >
              <Text style={styles.ctaLabel}>{busy ? t('Envoi…') : t('Préparer la demande')}</Text>
            </Pressable>
          </View>
        )}
      </Sheet>
    </View>
  );
}

function Choice({ on, label, onPress, a11y }: { on: boolean; label: string; onPress: () => void; a11y?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      aria-selected={on}
      style={[styles.choice, on && styles.choiceOn]}
    >
      <Text style={styles.choiceLabel}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 140, gap: 14 },
  back: {
    alignSelf: 'flex-start',
    padding: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityBody: { flex: 1, gap: 4, alignItems: 'flex-start' },
  name: { fontFamily: fonts.heading, fontSize: 22, color: colors.foreground },
  muted: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.mutedForeground },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.lg },
  badgeOn: { backgroundColor: colors.successSurface },
  badgeOff: { backgroundColor: colors.warningSurface },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 11 },
  badgeTextOn: { color: colors.success },
  badgeTextOff: { color: colors.warning },
  card: {
    padding: 14,
    gap: 8,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  sectionTitle: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.foreground },
  bio: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.foreground },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  rowValue: { flexShrink: 1, textAlign: 'right', fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  cta: {
    height: 52,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { opacity: 0.5 },
  ctaLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryForeground },
  form: { gap: 10 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
  },
  textarea: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  choiceOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  choiceLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
});
