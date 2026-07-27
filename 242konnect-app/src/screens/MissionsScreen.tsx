import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { ProAvatar } from '../components/Avatar';
import { Sheet } from '../components/Sheet';
import { PhoneField } from '../components/form';
import { formatFcfaFull, getProfessional, professionalTrade } from '../data';
import {
  PAYMENT_METHODS,
  paymentMethodLabel,
  useStore,
  type Booking,
  type PaymentMethod,
} from '../store';
import { normalizePhone, useAuth } from '../auth';
import { colors, fonts, radius, shadow } from '../theme';

const STATUS: Record<Booking['status'], { label: string; bg: string; fg: string }> = {
  pending: { label: 'En attente', bg: colors.muted, fg: colors.mutedForeground },
  confirmed: { label: 'Confirmée', bg: 'rgba(0,166,81,0.12)', fg: colors.primary },
  paid: { label: 'Payée', bg: 'rgba(0,166,81,0.18)', fg: colors.primary },
  cancelled: { label: 'Annulée', bg: 'rgba(237,28,36,0.1)', fg: colors.destructive },
};

export function MissionsScreen() {
  const insets = useSafeAreaInsets();
  const { bookings, payments, payBooking, cancelBooking } = useStore();
  const { account } = useAuth();

  const [paying, setPaying] = useState<Booking | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [payPhone, setPayPhone] = useState(account?.phone ?? '');
  const [receipt, setReceipt] = useState<{ reference: string; amount: number; method: PaymentMethod } | null>(null);

  const openPayment = (booking: Booking) => {
    setPaying(booking);
    setMethod(null);
    setReceipt(null);
    setPayPhone(account?.phone ?? '');
  };

  const confirmPayment = () => {
    if (!paying || !method) return;
    const payment = payBooking(paying.id, method, paying.rate);
    setReceipt({ reference: payment.reference, amount: payment.amount, method });
  };

  // Mobile Money debits a number; cash doesn't need one.
  const needsPhone = method === 'mtn' || method === 'airtel';
  const canPay = !!method && (!needsPhone || normalizePhone(payPhone).length === 9);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.title}>Missions</Text>
        {payments.length > 0 && (
          <Text style={styles.subtitle}>
            {payments.length} paiement{payments.length > 1 ? 's' : ''} ·{' '}
            {formatFcfaFull(payments.reduce((sum, p) => sum + p.amount, 0))} FCFA
          </Text>
        )}
      </View>

      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="solar:calendar-mark-linear" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={styles.emptyTitle}>Aucune mission</Text>
          <Text style={styles.emptyBody}>
            Réservez un professionnel depuis son profil : la mission apparaîtra ici, avec le
            paiement.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {bookings.map((booking) => {
            const pro = getProfessional(booking.professionalId);
            if (!pro) return null;
            const status = STATUS[booking.status];
            const payment = payments.find((p) => p.id === booking.paymentId);
            return (
              <View key={booking.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <ProAvatar professional={pro} size={48} rounded={24} />
                  <View style={styles.cardIdentity}>
                    <Text style={styles.cardName}>{pro.name}</Text>
                    <Text style={styles.cardTrade}>{professionalTrade(pro)?.label ?? ''}</Text>
                  </View>
                  <View style={[styles.status, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusLabel, { color: status.fg }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.meta}>
                  <View style={styles.metaRow}>
                    <Icon name="solar:calendar-mark-linear" size={16} color={colors.mutedForeground} />
                    <Text style={styles.metaText}>{booking.slot}</Text>
                  </View>
                  <Text style={styles.rate}>{formatFcfaFull(booking.rate)} FCFA/h</Text>
                </View>

                {payment && (
                  <Text style={styles.receiptLine}>
                    Payé par {paymentMethodLabel(payment.method)} · réf. {payment.reference}
                  </Text>
                )}

                {booking.status === 'confirmed' && (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => cancelBooking(booking.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Annuler la mission avec ${pro.name}`}
                      style={styles.cancel}
                    >
                      <Text style={styles.cancelLabel}>Annuler</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => openPayment(booking)}
                      accessibilityRole="button"
                      accessibilityLabel={`Payer la mission avec ${pro.name}`}
                      style={styles.pay}
                    >
                      <Text style={styles.payLabel}>Payer</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <Sheet
        visible={!!paying}
        title={receipt ? 'Paiement enregistré' : 'Payer la mission'}
        onClose={() => setPaying(null)}
      >
        {receipt ? (
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Icon name="solar:shield-check-bold" size={32} color={colors.primary} />
            </View>
            <Text style={styles.doneTitle}>{formatFcfaFull(receipt.amount)} FCFA</Text>
            <Text style={styles.doneBody}>
              {paymentMethodLabel(receipt.method)} · référence {receipt.reference}
            </Text>
            <Text style={styles.doneWarning}>
              Démonstration : aucun argent n'a été débité. Un vrai paiement nécessite un compte
              marchand Mobile Money et un serveur.
            </Text>
            <Pressable onPress={() => setPaying(null)} accessibilityRole="button" style={styles.doneButton}>
              <Text style={styles.payLabel}>Terminé</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sheetAmount}>
              {paying ? formatFcfaFull(paying.rate) : 0} <Text style={styles.sheetCurrency}>FCFA</Text>
            </Text>
            <Text style={styles.sheetHint}>Choisissez un moyen de paiement</Text>
            {PAYMENT_METHODS.map((m) => {
              const selected = method === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMethod(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected }}
                  style={[styles.method, selected && styles.methodSelected]}
                >
                  <View style={styles.methodBody}>
                    <Text style={[styles.methodLabel, selected && styles.methodLabelSelected]}>
                      {m.label}
                    </Text>
                    <Text style={styles.methodHint}>{m.hint}</Text>
                  </View>
                  {selected && <Icon name="solar:shield-check-bold" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}

            {needsPhone && (
              <View style={styles.payPhone}>
                <PhoneField value={payPhone} onChangeText={setPayPhone} />
              </View>
            )}

            <Pressable
              onPress={confirmPayment}
              disabled={!canPay}
              accessibilityRole="button"
              accessibilityLabel="Confirmer le paiement"
              accessibilityState={{ disabled: !canPay }}
              style={[styles.doneButton, !canPay && styles.doneButtonOff]}
            >
              <Text style={styles.payLabel}>
                {method === 'especes' ? 'Confirmer (à régler sur place)' : 'Confirmer le paiement'}
              </Text>
            </Pressable>
          </>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.foreground },
  subtitle: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  list: { padding: 20, paddingTop: 4, gap: 14 },
  card: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius['2xl'],
    ...shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIdentity: { flex: 1 },
  cardName: { fontFamily: fonts.heading, fontSize: 15, color: colors.foreground },
  cardTrade: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.primary },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.lg },
  statusLabel: { fontFamily: fonts.sansBold, fontSize: 11 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground },
  rate: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.foreground },
  receiptLine: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  actions: { flexDirection: 'row', gap: 10 },
  cancel: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.mutedForeground },
  pay: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.primaryForeground },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, paddingBottom: 120 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.foreground },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
    textAlign: 'center',
    maxWidth: 280,
  },
  sheetAmount: { fontFamily: fonts.heading, fontSize: 30, color: colors.foreground },
  sheetCurrency: { fontSize: 16, color: colors.mutedForeground },
  sheetHint: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.mutedForeground, marginVertical: 12 },
  method: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  methodSelected: { borderColor: colors.primary, backgroundColor: colors.muted },
  methodBody: { flex: 1 },
  methodLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  methodLabelSelected: { color: colors.primary },
  methodHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
  payPhone: { marginBottom: 12 },
  doneButton: {
    height: 56,
    borderRadius: radius['2xl'],
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  doneButtonOff: { backgroundColor: colors.mutedForeground, opacity: 0.5 },
  done: { alignItems: 'center', gap: 8 },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.foreground },
  doneBody: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.mutedForeground, textAlign: 'center' },
  doneWarning: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: 4,
  },
});
