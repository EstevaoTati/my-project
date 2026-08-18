import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/Avatar';
import { formatFcfaFull, getTrade } from '../data';
import { COMMISSION_RATE, PAYOUT_EXPRESS_RATE, PAYOUT_STANDARD_RATE, PAYOUT_STANDARD_DELAY_DAYS } from '../payments';
import { useAuth } from '../auth';
import { colors, fonts, radius, shadow } from '../theme';

/**
 * Espace Prestataire — the dashboard of §2.2.
 *
 * An honest constraint runs through this screen: a prestataire's dashboard is
 * mostly made of *other people's* actions — demandes received, missions
 * accepted, revenue earned, clients served. None of that can exist on a device
 * with no backend and no other users.
 *
 * So the sections the spec lists are all here, but the ones that depend on a
 * counterparty show a stated empty state rather than invented numbers. What is
 * real — the profile, the trade and rate, the documents submitted, the payout
 * terms — is shown for real.
 */

const SUBSCRIPTIONS = [
  { id: 'standard', label: 'Standard', price: 'Gratuit', perks: ['Profil public', 'Réception des demandes'] },
  { id: 'premium', label: 'Premium', price: 'À définir', perks: ['Priorité dans les résultats', 'Badge Premium'] },
  { id: 'business', label: 'Business', price: 'À définir', perks: ['Appels d’offres entreprises', 'Support prioritaire'] },
];

export function EspacePrestataireScreen() {
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  if (!account) return null;

  const details = account.prestataire;
  const trade = details?.tradeId ? getTrade(details.tradeId) : undefined;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Espace Prestataire</Text>

      <View style={styles.identity}>
        <UserAvatar name={account.name} avatar={account.avatar} size={56} />
        <View style={styles.identityBody}>
          <Text style={styles.name}>{account.name}</Text>
          <Text style={styles.trade}>{trade?.label ?? 'Métier non renseigné'}</Text>
          {!!details?.zone && <Text style={styles.zone}>Zone : {details.zone}</Text>}
        </View>
        <View style={[styles.badge, details?.verified ? styles.badgeOn : styles.badgeOff]}>
          <Text style={[styles.badgeLabel, details?.verified ? styles.badgeLabelOn : styles.badgeLabelOff]}>
            {details?.verified ? 'Vérifié' : 'En attente'}
          </Text>
        </View>
      </View>

      {/* §7.6: the badge is awarded by 242Konnect after checking documents. It
          is never something the prestataire can switch on. */}
      {!details?.verified && (
        <View style={styles.notice}>
          <Icon name="solar:shield-check-bold" size={18} color={colors.warning} />
          <Text style={styles.noticeText}>
            {details
              ? "Votre compte est en attente de vérification. 242Konnect contrôle vos pièces justificatives avant d'attribuer le badge « Prestataire vérifié »."
              : "Profil prestataire incomplet : métier, zone d'intervention, tarif et pièces justificatives manquent. Renseignez-les depuis Profil › Modifier le profil pour recevoir des demandes."}
          </Text>
        </View>
      )}

      <Section title="Revenus">
        <View style={styles.grid}>
          {['Aujourd’hui', 'Cette semaine', 'Ce mois', 'Cette année'].map((label) => (
            <View key={label} style={styles.gridCell}>
              <Text style={styles.gridValue}>0</Text>
              <Text style={styles.gridUnit}>FCFA</Text>
              <Text style={styles.gridLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.sectionNote}>
          Aucune mission reçue : il n'y a pas encore de clients sur cette version. Les revenus
          apparaîtront ici dès qu'une prestation sera validée.
        </Text>
      </Section>

      <Section title="Demandes et missions">
        {[
          ['Demandes en attente', 'Les demandes correspondant à votre métier arriveront ici.'],
          ['Missions acceptées', 'Rien pour le moment.'],
          ['Missions en cours', 'Rien pour le moment.'],
          ['Missions terminées', 'Rien pour le moment.'],
        ].map(([label, hint]) => (
          <View key={label} style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowHint}>{hint}</Text>
            </View>
            <Text style={styles.rowCount}>0</Text>
          </View>
        ))}
      </Section>

      <Section title="Performance">
        <View style={styles.scoreRow}>
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>—</Text>
            <Text style={styles.gridLabel}>Score 242K</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>0</Text>
            <Text style={styles.gridLabel}>Services réalisés</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreBlock}>
            <Text style={styles.scoreValue}>0</Text>
            <Text style={styles.gridLabel}>Clients</Text>
          </View>
        </View>
        <Text style={styles.sectionNote}>
          Le Score 242K se calcule à partir des prestations réalisées, des avis, de la ponctualité
          et du taux d'annulation (§7.5). Il reste vide tant qu'aucune mission n'a eu lieu.
        </Text>
      </Section>

      <Section title="Vos conditions">
        <InfoRow label="Tarif horaire" value={details?.hourlyRate ? `${formatFcfaFull(details.hourlyRate)} FCFA` : '—'} />
        <InfoRow label="Commission 242Konnect" value={`${COMMISSION_RATE * 100} %`} />
        <InfoRow
          label="Versement standard"
          value={`${PAYOUT_STANDARD_DELAY_DAYS} jours · ${(PAYOUT_STANDARD_RATE * 100).toLocaleString('fr-FR')} %`}
        />
        <InfoRow label="Versement express" value={`Immédiat · ${PAYOUT_EXPRESS_RATE * 100} %`} />
        <Text style={styles.sectionNote}>
          Vous ne recevez jamais d'argent directement du client. 242Konnect encaisse, conserve
          les fonds, puis vous verse après validation de la prestation.
        </Text>
      </Section>

      <Section title="Documents">
        {details?.documents?.length ? (
          details.documents.map((_, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Pièce justificative {i + 1}</Text>
                <Text style={styles.rowHint}>En attente de vérification par 242Konnect</Text>
              </View>
              <View style={styles.pending}>
                <Text style={styles.pendingLabel}>En cours</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.sectionNote}>
            Aucune pièce transmise. Les documents accélèrent la vérification de votre compte.
          </Text>
        )}
      </Section>

      <Section title="Abonnement">
        {SUBSCRIPTIONS.map((plan, i) => (
          <View key={plan.id} style={[styles.plan, i === 0 && styles.planActive]}>
            <View style={styles.planHead}>
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
            </View>
            {plan.perks.map((perk) => (
              <Text key={perk} style={styles.planPerk}>
                · {perk}
              </Text>
            ))}
            {i === 0 && <Text style={styles.planCurrent}>Votre formule actuelle</Text>}
          </View>
        ))}
        <Text style={styles.sectionNote}>
          Les tarifs Premium et Business ne sont pas encore fixés, et la souscription demande le
          système de paiement des abonnements.
        </Text>
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Cet espace affiche la structure décrite au cahier des charges §2.2. Les sections qui
          dépendent d'autres utilisateurs — demandes, revenus, avis — restent vides tant qu'il n'y
          a pas de serveur : elles ne sont pas simulées.
        </Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 140, gap: 18 },
  screenTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  identityBody: { flex: 1 },
  name: { fontFamily: fonts.heading, fontSize: 17, color: colors.foreground },
  trade: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  zone: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.lg },
  badgeOn: { backgroundColor: colors.successSurface },
  badgeOff: { backgroundColor: colors.warningSurface },
  badgeLabel: { fontFamily: fonts.sansBold, fontSize: 11 },
  badgeLabelOn: { color: colors.success },
  badgeLabelOff: { color: colors.warning },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.warningSurface,
    borderWidth: 1,
    borderColor: 'rgba(180,83,9,0.25)',
  },
  noticeText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 18, color: colors.warning },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  card: {
    padding: 14,
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
  },
  sectionNote: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCell: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
  },
  gridValue: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.foreground },
  gridUnit: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground },
  gridLabel: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  rowHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  rowCount: { fontFamily: fonts.headingBold, fontSize: 18, color: colors.mutedForeground },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreBlock: { flex: 1, alignItems: 'center' },
  scoreDivider: { width: 1, height: 32, backgroundColor: colors.border },
  scoreValue: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.foreground },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.mutedForeground },
  infoValue: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  pending: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md, backgroundColor: colors.warningSurface },
  pendingLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.warning },
  plan: { padding: 12, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  planActive: { borderColor: colors.accent, backgroundColor: colors.muted },
  planHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  planLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  planPrice: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  planPerk: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  planCurrent: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.foreground, marginTop: 6 },
  footer: { paddingTop: 4 },
  footerText: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
});
