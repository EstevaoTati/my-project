import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../Sheet';
import { Icon } from '../Icon';
import { useAuth } from '../../auth';
import { categories, tradesInCategory, type CategoryId, type Trade } from '../../data/trades';
import { createRequest, marketplaceEnabled } from '../../marketplace';
import { LONG_DURATIONS, type MissionDuration } from '../../store';
import { colors, fonts, radius } from '../../theme';
import { T, useT } from '../../i18n';

const SLOTS = [T('Dès que possible'), "Aujourd'hui, 14h00", "Aujourd'hui, 16h30", 'Demain, 09h00', 'Demain, 11h00'];

const DURATIONS: { id: MissionDuration; label: string }[] = [
  { id: 'hours', label: T('Quelques heures') },
  { id: 'days', label: T('Quelques jours') },
  { id: 'weeks', label: T('Quelques semaines') },
  { id: 'months', label: T('Plusieurs mois') },
  { id: 'recurring', label: T('Service récurrent') },
];

/**
 * "Publier une demande" — an open request, sent to every approved and
 * available prestataire of the chosen trade in the client's city
 * (provider plan, phase 1). The first one to accept gets the mission.
 *
 * It replaces a demo that said "Votre demande est en ligne" and sent nothing.
 * Like any request, it is created as a draft and reaches nobody until the
 * payment service confirms the payment, from the Missions tab.
 */
export function OpenRequestSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  /** After the draft exists: take the client to pay for it. */
  onCreated: () => void;
}) {
  const t = useT();
  const { account, marketSession } = useAuth();
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [description, setDescription] = useState('');
  const [zone, setZone] = useState('');
  const [address, setAddress] = useState('');
  const [slot, setSlot] = useState<string | null>(null);
  const [duration, setDuration] = useState<MissionDuration>('hours');
  const [budget, setBudget] = useState('');
  const [contract, setContract] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const savedAddress = account?.particulier
    ? `${account.particulier.address}${account.particulier.addressReference ? ` (${account.particulier.addressReference})` : ''}`
    : '';
  const city = account?.location.city ?? '';
  const currency = account?.location.country === 'US' ? 'USD' : 'FCFA';
  const amount = Number(budget.replace(/\D/g, ''));
  const finalAddress = (address || savedAddress).trim();
  const long = LONG_DURATIONS.includes(duration);
  const ready = !!trade && !!slot && finalAddress.length >= 3 && amount > 0 && !!city && (!long || contract);

  const reset = () => {
    setCategory(null);
    setTrade(null);
    setDescription('');
    setZone('');
    setAddress('');
    setSlot(null);
    setDuration('hours');
    setBudget('');
    setContract(false);
    setError(null);
    setCreated(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const pickTrade = (next: Trade) => {
    setTrade(next);
    // A starting point, from the indicative range of the trade; the client sets it.
    if (!budget && currency === 'FCFA') setBudget(String(next.minRate));
  };

  const submit = async () => {
    if (!ready || !trade || !slot) return;
    setBusy(true);
    setError(null);
    try {
      const session = await marketSession();
      if (!session) throw new Error(t('Votre session a expiré. Reconnectez-vous.'));
      await createRequest(session, {
        providerId: null,
        tradeId: trade.id,
        city,
        description: description.trim(),
        // The quarter, never the door: all a prestataire sees before accepting.
        zoneHint: zone.trim() || city,
        address: finalAddress,
        slot,
        duration,
        contractSigned: contract,
        amount,
        currency,
      });
      setCreated(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Demande impossible.'));
    } finally {
      setBusy(false);
    }
  };

  const title = created ? t('Demande préparée') : t('Publier une demande');

  return (
    <Sheet visible={visible} title={title} onClose={close}>
      {!marketplaceEnabled ? (
        <Text style={styles.hint}>{t('La publication de demandes n’est pas disponible sur cette version de l’application.')}</Text>
      ) : created ? (
        <View style={styles.done}>
          <View style={styles.doneIcon}>
            <Icon name="solar:shield-check-bold" size={30} color={colors.foreground} />
          </View>
          <Text style={styles.doneTitle}>{t('Il reste à la payer')}</Text>
          <Text style={styles.doneBody}>
            {t('Une fois le paiement confirmé, votre demande est envoyée aux prestataires vérifiés de votre ville. Le premier qui accepte obtient la mission ; vous êtes remboursé si personne ne répond.')}
          </Text>
          <Pressable
            onPress={() => {
              reset();
              onCreated();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('Payer la demande')}
            style={styles.primary}
          >
            <Text style={styles.primaryLabel}>{t('Payer la demande')}</Text>
          </Pressable>
        </View>
      ) : !category ? (
        <>
          <Text style={styles.hint}>{t('De quel service avez-vous besoin ?')}</Text>
          {categories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`Publier une demande en ${c.label}`}
              style={styles.row}
            >
              <Icon name={c.icon} size={24} color={colors.foreground} />
              <Text style={styles.rowLabel}>{t(c.label)}</Text>
              <Icon name="solar:arrow-right-bold" size={20} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </>
      ) : !trade ? (
        <>
          <Pressable onPress={() => setCategory(null)} accessibilityRole="button" accessibilityLabel={t('Retour')} style={styles.back}>
            <Icon name="solar:alt-arrow-left-linear" size={20} color={colors.foreground} />
            <Text style={styles.backLabel}>{t('Catégories')}</Text>
          </Pressable>
          <Text style={styles.hint}>{t('Quel métier ?')}</Text>
          {tradesInCategory(category).map((tr) => (
            <Pressable
              key={tr.id}
              onPress={() => pickTrade(tr)}
              accessibilityRole="button"
              accessibilityLabel={`${t('Métier')} ${t(tr.label)}`}
              style={styles.row}
            >
              <Text style={styles.rowLabel}>{t(tr.label)}</Text>
              <Icon name="solar:arrow-right-bold" size={20} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </>
      ) : (
        <View style={styles.form}>
          <Pressable onPress={() => setTrade(null)} accessibilityRole="button" accessibilityLabel={t('Retour')} style={styles.back}>
            <Icon name="solar:alt-arrow-left-linear" size={20} color={colors.foreground} />
            <Text style={styles.backLabel}>{t(trade.label)}</Text>
          </Pressable>
          <Text style={styles.note}>
            {city
              ? t('Envoyée à tous les prestataires vérifiés en {trade} à {city}.', { trade: t(trade.label), city })
              : t('Indiquez votre ville dans votre profil pour publier une demande.')}
          </Text>

          <Text style={styles.label}>{t('Description')}</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('Décrivez le besoin en quelques mots')}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t('Description de la demande')}
            multiline
            maxLength={2000}
            style={[styles.input, styles.multiline]}
          />

          <Text style={styles.label}>{t('Quartier')}</Text>
          <TextInput
            value={zone}
            onChangeText={setZone}
            placeholder={t('Visible avant acceptation, ex. Mpaka')}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t('Quartier')}
            maxLength={200}
            style={styles.input}
          />

          <Text style={styles.label}>{t('Adresse exacte')}</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={savedAddress || t('Rue, numéro, repère')}
            placeholderTextColor={colors.mutedForeground}
            accessibilityLabel={t('Adresse exacte')}
            maxLength={400}
            style={styles.input}
          />
          <Text style={styles.small}>{t('Communiquée seulement au prestataire qui accepte.')}</Text>

          <Text style={styles.label}>{t('Quand ?')}</Text>
          <View style={styles.chips}>
            {SLOTS.map((x) => (
              <Pressable key={x} onPress={() => setSlot(x)} accessibilityRole="radio" aria-selected={slot === x} accessibilityLabel={t(x)} style={[styles.chip, slot === x && styles.chipOn]}>
                <Text style={styles.chipLabel}>{t(x)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('Durée')}</Text>
          <View style={styles.chips}>
            {DURATIONS.map((d) => (
              <Pressable key={d.id} onPress={() => setDuration(d.id)} accessibilityRole="radio" aria-selected={duration === d.id} accessibilityLabel={t(d.label)} style={[styles.chip, duration === d.id && styles.chipOn]}>
                <Text style={styles.chipLabel}>{t(d.label)}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t('Budget')} ({currency})</Text>
          <TextInput
            value={budget}
            onChangeText={(v) => setBudget(v.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            accessibilityLabel={t('Budget de la demande')}
            style={styles.input}
          />

          {long && (
            <Pressable onPress={() => setContract((v) => !v)} accessibilityRole="checkbox" aria-checked={contract} accessibilityLabel={t('Je signe le contrat de projet')} style={styles.check}>
              <View style={[styles.box, contract && styles.boxOn]} />
              <Text style={styles.checkLabel}>{t('Projet long : je signe le contrat de projet (jalons et validation par étape).')}</Text>
            </Pressable>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={submit} disabled={!ready || busy} accessibilityRole="button" accessibilityLabel={t('Préparer la demande ouverte')} style={[styles.primary, (!ready || busy) && styles.off]}>
            <Text style={styles.primaryLabel}>{busy ? t('Envoi…') : t('Préparer la demande')}</Text>
          </Pressable>
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowLabel: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  form: { gap: 8 },
  note: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 17, color: colors.foreground, backgroundColor: '#fff7d1', borderRadius: radius.lg, padding: 10 },
  label: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.foreground, marginTop: 6 },
  small: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  input: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.foreground,
  },
  multiline: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.foreground },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.border },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.foreground },
  error: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.destructive },
  primary: { height: 52, borderRadius: radius['2xl'], backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryLabel: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.primaryForeground },
  off: { opacity: 0.5 },
  done: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground },
  doneBody: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.mutedForeground, textAlign: 'center' },
});
