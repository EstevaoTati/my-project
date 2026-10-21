import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Field } from './form';
import {
  DURATIONS,
  PRICING_MODELS,
  type Currency,
  type PricingModel,
  type ProjectDuration,
} from '../pricing';
import { colors, fonts, radius } from '../theme';
import { useT } from '../i18n';

/**
 * Model, amount, negotiable and accepted durations — Parcours Prestataire §03.
 *
 * One component for sign-up and for the profile editor, so the rule that no
 * model is preselected cannot hold in one place and quietly lapse in the other.
 */
export function PricingEditor({
  currency,
  model,
  onModel,
  amount,
  onAmount,
  negotiable,
  onNegotiable,
  durations,
  onDurations,
}: {
  currency: Currency;
  model: PricingModel | null;
  onModel: (m: PricingModel) => void;
  amount: string;
  onAmount: (v: string) => void;
  negotiable: boolean;
  onNegotiable: (v: boolean) => void;
  durations: ProjectDuration[];
  onDurations: (d: ProjectDuration[]) => void;
}) {
  const t = useT();
  return (
    <>
      <View>
        <Text style={styles.label}>{t('Modèle de prix')}</Text>
        <Text style={styles.hint}>
          {t('Devise selon votre pays :')} {currency}
        </Text>
        <View style={styles.chips}>
          {PRICING_MODELS.map((m) => {
            const on = model === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => onModel(m.id)}
                accessibilityRole="radio"
                accessibilityLabel={`${t('Modèle de prix')} ${t(m.label)}`}
                aria-selected={on}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t(m.label)}</Text>
              </Pressable>
            );
          })}
        </View>
        {model && <Text style={styles.hint}>{t(PRICING_MODELS.find((m) => m.id === model)!.hint)}</Text>}
      </View>

      {model && model !== 'quote' && (
        <Field
          label={`${t('Montant')} (${currency}${model === 'hourly' ? '/h' : ''})`}
          accessibilityLabel={t('Montant')}
          value={amount}
          onChangeText={(v) => onAmount(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder={currency === 'USD' ? '40' : '15000'}
        />
      )}

      <Pressable
        onPress={() => onNegotiable(!negotiable)}
        accessibilityRole="checkbox"
        accessibilityLabel={t('Prix négociable')}
        aria-checked={negotiable}
        style={styles.checkRow}
      >
        <View style={[styles.box, negotiable && styles.boxOn]}>
          {negotiable && <Icon name="242k:check" size={14} color={colors.accentForeground} />}
        </View>
        <Text style={styles.checkLabel}>{t('Prix négociable')}</Text>
      </Pressable>

      <View>
        <Text style={styles.label}>{t('Durées de mission acceptées')}</Text>
        <View style={styles.chips}>
          {DURATIONS.map((d) => {
            const on = durations.includes(d.id);
            return (
              <Pressable
                key={d.id}
                onPress={() =>
                  onDurations(on ? durations.filter((x) => x !== d.id) : [...durations, d.id])
                }
                accessibilityRole="button"
                accessibilityLabel={`${t('Durée')} ${t(d.label)}`}
                aria-selected={on}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{t(d.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground, marginBottom: 6 },
  hint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground, marginBottom: 8 },
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
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
});
