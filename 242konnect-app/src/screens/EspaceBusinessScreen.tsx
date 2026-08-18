import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/Avatar';
import { Field, FormError } from '../components/form';
import { Sheet } from '../components/Sheet';
import { formatFcfaFull } from '../data';
import { isValidEmail, useAuth } from '../auth';
import {
  COLLABORATOR_ROLES,
  ESTABLISHMENT_KINDS,
  useStore,
  type CollaboratorRole,
  type Establishment,
} from '../store';
import { colors, fonts, radius, shadow } from '../theme';

/**
 * Espace Business — the dashboard of §2.2.
 *
 * Unlike the prestataire dashboard, a good part of this one is the company's
 * *own* records: its establishments and its collaborators. Those need nobody
 * else to exist, so they are genuinely editable here and persist per account.
 *
 * The rest — quotes received, prestataires who responded, spend — depends on
 * the marketplace having other users and a payment backend, and is shown as a
 * stated empty state rather than invented figures.
 */
export function EspaceBusinessScreen() {
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  const {
    establishments,
    collaborators,
    addEstablishment,
    removeEstablishment,
    inviteCollaborator,
    removeCollaborator,
    bookings,
    totalPaid,
    heldInEscrow,
  } = useStore();

  const [showEstablishment, setShowEstablishment] = useState(false);
  const [estName, setEstName] = useState('');
  const [estKind, setEstKind] = useState<Establishment['kind']>('agence');
  const [estAddress, setEstAddress] = useState('');

  const [showCollaborator, setShowCollaborator] = useState(false);
  const [colName, setColName] = useState('');
  const [colEmail, setColEmail] = useState('');
  const [colRole, setColRole] = useState<CollaboratorRole>('employe');
  const [colError, setColError] = useState<string | null>(null);

  if (!account) return null;
  const business = account.business;

  const saveEstablishment = () => {
    if (!estName.trim() || !estAddress.trim()) return;
    addEstablishment({ name: estName.trim(), kind: estKind, address: estAddress.trim() });
    setEstName('');
    setEstAddress('');
    setEstKind('agence');
    setShowEstablishment(false);
  };

  const saveCollaborator = () => {
    setColError(null);
    if (colName.trim().length < 2) {
      setColError('Entrez le nom du collaborateur.');
      return;
    }
    if (!isValidEmail(colEmail)) {
      setColError('Entrez une adresse e-mail valide.');
      return;
    }
    inviteCollaborator({ name: colName.trim(), email: colEmail.trim().toLowerCase(), role: colRole });
    setColName('');
    setColEmail('');
    setColRole('employe');
    setShowCollaborator(false);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Espace Business</Text>

        <View style={styles.identity}>
          <UserAvatar name={business?.companyName ?? account.name} avatar={business?.logo} size={56} />
          <View style={styles.identityBody}>
            <Text style={styles.name}>{business?.companyName ?? 'Entreprise'}</Text>
            <Text style={styles.sector}>{business?.sector ?? 'Secteur non renseigné'}</Text>
            {!!business?.rccm && <Text style={styles.legal}>RCCM {business.rccm} · NIF {business.nif}</Text>}
          </View>
          <View style={styles.badgeOff}>
            <Text style={styles.badgeLabelOff}>En attente</Text>
          </View>
        </View>

        {/* A profile activated from the Profil tab has none of its own details
            yet — §2.2 collects those at sign-up. Say what is missing rather
            than showing "non renseigné" everywhere and leaving it there. */}
        <View style={styles.notice}>
          <Icon name="solar:shield-check-bold" size={18} color={colors.warning} />
          <Text style={styles.noticeText}>
            {business
              ? "Compte en attente de validation. 242Konnect vérifie les documents légaux (RCCM, NIF, patente) avant d'activer les fonctionnalités entreprise."
              : "Profil entreprise incomplet : raison sociale, RCCM, NIF, secteur et adresse manquent. Renseignez-les depuis Profil › Modifier le profil pour que votre compte puisse être validé."}
          </Text>
        </View>

        <Section title="Gestion des demandes">
          {[
            ['Demandes en attente', 0],
            ['Demandes publiées', 0],
            ['Prestataires ayant répondu', 0],
            ['Interventions programmées', 0],
            ['Interventions en cours', bookings.filter((b) => b.status === 'payee').length],
            ['Interventions terminées', bookings.filter((b) => b.status === 'validee').length],
          ].map(([label, count]) => (
            <View key={String(label)} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowCount}>{count}</Text>
            </View>
          ))}
          <Text style={styles.note}>
            Les appels d'offres et la comparaison de devis demandent que des prestataires puissent
            répondre — donc un serveur.
          </Text>
        </Section>

        <Section
          title="Établissements"
          action={{ label: 'Ajouter', onPress: () => setShowEstablishment(true), a11y: 'Ajouter un établissement' }}
        >
          {establishments.length === 0 ? (
            <Text style={styles.note}>
              Aucun établissement. Ajoutez vos agences, bureaux, magasins ou chantiers pour
              rattacher chaque demande à un site.
            </Text>
          ) : (
            establishments.map((e) => (
              <View key={e.id} style={styles.itemRow}>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>{e.name}</Text>
                  <Text style={styles.itemMeta}>
                    {ESTABLISHMENT_KINDS.find((k) => k.id === e.kind)?.label} · {e.address}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeEstablishment(e.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Supprimer l'établissement ${e.name}`}
                  hitSlop={8}
                >
                  <Text style={styles.remove}>Supprimer</Text>
                </Pressable>
              </View>
            ))
          )}
        </Section>

        <Section
          title="Collaborateurs"
          action={{ label: 'Inviter', onPress: () => setShowCollaborator(true), a11y: 'Inviter un collaborateur' }}
        >
          {collaborators.length === 0 ? (
            <Text style={styles.note}>
              Aucun collaborateur. Invitez vos équipes avec des niveaux d'accès différents :
              administrateur, responsable, comptable, acheteur, maintenance.
            </Text>
          ) : (
            collaborators.map((c) => (
              <View key={c.id} style={styles.itemRow}>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName}>{c.name}</Text>
                  <Text style={styles.itemMeta}>
                    {COLLABORATOR_ROLES.find((r) => r.id === c.role)?.label} · {c.email}
                  </Text>
                </View>
                <View style={styles.pending}>
                  <Text style={styles.pendingLabel}>Invité</Text>
                </View>
                <Pressable
                  onPress={() => removeCollaborator(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${c.name}`}
                  hitSlop={8}
                >
                  <Text style={styles.remove}>Retirer</Text>
                </Pressable>
              </View>
            ))
          )}
          {collaborators.length > 0 && (
            <Text style={styles.note}>
              Les invitations ne partent pas encore : l'envoi et l'acceptation demandent un
              serveur. Les rôles sont enregistrés sur cet appareil.
            </Text>
          )}
        </Section>

        <Section title="Gestion financière">
          <InfoRow label="Dépenses engagées" value={`${formatFcfaFull(totalPaid)} FCFA`} />
          <InfoRow label="En attente de validation" value={`${formatFcfaFull(heldInEscrow)} FCFA`} />
          <InfoRow label="Devis reçus" value="0" />
          <InfoRow label="Factures" value="0" />
          <Text style={styles.note}>
            Les devis, factures et rapports PDF/Excel demandent la facturation côté serveur.
          </Text>
        </Section>

        <Section title="Circuit de validation interne">
          <Text style={styles.note}>
            Optionnel (§2.2) : un employé crée la demande, le responsable la valide, le
            responsable financier approuve le budget, puis elle est publiée. Ce circuit demande
            les rôles côté serveur et n'est pas actif.
          </Text>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Cet espace suit la structure du cahier des charges §2.2. Vos établissements et
            collaborateurs sont réellement enregistrés sur cet appareil ; tout ce qui dépend
            d'autres utilisateurs ou de la facturation reste vide plutôt que simulé.
          </Text>
        </View>
      </ScrollView>

      <Sheet
        visible={showEstablishment}
        title="Ajouter un établissement"
        onClose={() => setShowEstablishment(false)}
      >
        <Field label="Nom" value={estName} onChangeText={setEstName} placeholder="Agence Centre-ville" />
        <View style={styles.kinds}>
          {ESTABLISHMENT_KINDS.map((k) => {
            const on = estKind === k.id;
            return (
              <Pressable
                key={k.id}
                onPress={() => setEstKind(k.id)}
                accessibilityRole="radio"
                accessibilityLabel={`Type ${k.label}`}
                accessibilityState={{ selected: on }}
                style={[styles.kindChip, on && styles.kindChipOn]}
              >
                <Text style={[styles.kindLabel, on && styles.kindLabelOn]}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Adresse" value={estAddress} onChangeText={setEstAddress} placeholder="Quartier, avenue" />
        <Pressable
          onPress={saveEstablishment}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer l'établissement"
          style={[styles.submit, (!estName.trim() || !estAddress.trim()) && styles.submitOff]}
        >
          <Text style={styles.submitLabel}>Enregistrer</Text>
        </Pressable>
      </Sheet>

      <Sheet
        visible={showCollaborator}
        title="Inviter un collaborateur"
        onClose={() => setShowCollaborator(false)}
      >
        <Field label="Nom" value={colName} onChangeText={setColName} autoCapitalize="words" />
        <Field
          label="E-mail"
          value={colEmail}
          onChangeText={setColEmail}
          autoCapitalize="none"
          inputMode="email"
          placeholder="collaborateur@entreprise.cg"
        />
        <Text style={styles.roleLabel}>Niveau d'accès</Text>
        {COLLABORATOR_ROLES.map((r) => {
          const on = colRole === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => setColRole(r.id)}
              accessibilityRole="radio"
              accessibilityLabel={`Rôle ${r.label}`}
              accessibilityState={{ selected: on }}
              style={[styles.roleRow, on && styles.roleRowOn]}
            >
              <View style={styles.itemBody}>
                <Text style={[styles.itemName, on && styles.roleNameOn]}>{r.label}</Text>
                <Text style={styles.itemMeta}>{r.can}</Text>
              </View>
              {on && <Icon name="solar:shield-check-bold" size={18} color={colors.foreground} />}
            </Pressable>
          );
        })}
        <FormError message={colError} />
        <Pressable
          onPress={saveCollaborator}
          accessibilityRole="button"
          accessibilityLabel="Envoyer l'invitation"
          style={styles.submit}
        >
          <Text style={styles.submitLabel}>Inviter</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void; a11y: string };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && (
          <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.a11y}>
            <Text style={styles.sectionAction}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
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
  sector: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground },
  legal: { fontFamily: fonts.sans, fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  badgeOff: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.lg, backgroundColor: colors.warningSurface },
  badgeLabelOff: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.warning },
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
  },
  sectionAction: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.foreground },
  card: {
    padding: 14,
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 13, color: colors.foreground },
  rowCount: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.mutedForeground },
  infoValue: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemBody: { flex: 1 },
  itemName: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  itemMeta: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  remove: { fontFamily: fonts.sansSemibold, fontSize: 12, color: colors.destructive },
  pending: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md, backgroundColor: colors.muted },
  pendingLabel: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.mutedForeground },
  note: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  kindChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  kindLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  kindLabelOn: { color: colors.accentForeground },
  roleLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground, marginTop: 12, marginBottom: 8 },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  roleRowOn: { borderColor: colors.accent, backgroundColor: colors.muted },
  roleNameOn: { color: colors.foreground },
  submit: {
    height: 52,
    marginTop: 8,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitOff: { opacity: 0.5 },
  submitLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryForeground },
  footer: { paddingTop: 4 },
  footerText: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.mutedForeground },
});
