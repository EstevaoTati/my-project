import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from './Icon';
import {
  CONGO_CITIES,
  COUNTRIES,
  countryFor,
  US_STATES,
  type CountryCode,
  type Location,
} from '../countries';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

/**
 * Where someone is, asked the way each country is actually addressed.
 *
 * The correction note is explicit that the two served countries need different
 * shapes: "Congo : les différentes villes du pays. USA : les différents États,
 * puis les informations de ville/localisation correspondantes."
 *
 * So Congo offers its cities as a list — there are fourteen worth naming and
 * people pick one. The United States asks for the state from a list and then
 * lets the city be typed, because shipping every US town in the bundle would
 * cost more than it helps and nobody needs a picker to spell where they live.
 */

type Props = {
  value: Location;
  onChange: (next: Location) => void;
  label?: string;
};

export function LocationField({ value, onChange, label = 'Où habitez-vous ?' }: Props) {
  const t = useT();
  const [picking, setPicking] = useState<null | 'country' | 'city' | 'state'>(null);
  const country = countryFor(value.country);

  const choose = (next: Partial<Location>) => {
    onChange({ ...value, ...next });
    setPicking(null);
  };

  const options =
    picking === 'country'
      ? COUNTRIES.map((c) => ({ key: c.code, label: `${c.flag}  ${c.nameFr}` }))
      : picking === 'city'
        ? CONGO_CITIES.map((c) => ({ key: c, label: c }))
        : picking === 'state'
          ? US_STATES.map((c) => ({ key: c, label: c }))
          : [];

  const onPick = (key: string) => {
    if (picking === 'country') {
      const code = key as CountryCode;
      // The previous city belongs to the previous country.
      choose({ country: code, city: '', state: undefined });
    } else if (picking === 'city') choose({ city: key });
    else if (picking === 'state') choose({ state: key });
  };

  const title =
    picking === 'country' ? 'Pays' : picking === 'city' ? 'Ville' : 'État';

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={() => setPicking('country')}
        accessibilityRole="button"
        accessibilityLabel={`Pays : ${country.nameFr}. Changer de pays`}
        style={styles.select}
      >
        <Text style={styles.selectValue}>
          {country.flag}  {country.nameFr}
        </Text>
        <Icon name="solar:alt-arrow-down-linear" size={16} color={colors.mutedForeground} />
      </Pressable>

      {value.country === 'US' && (
        <Pressable
          onPress={() => setPicking('state')}
          accessibilityRole="button"
          accessibilityLabel={value.state ? `État : ${value.state}. Changer d'État` : "Choisir l'État"}
          style={styles.select}
        >
          <Text style={[styles.selectValue, !value.state && styles.placeholder]}>
            {value.state ?? 'Choisir votre État'}
          </Text>
          <Icon name="solar:alt-arrow-down-linear" size={16} color={colors.mutedForeground} />
        </Pressable>
      )}

      {value.country === 'CG' ? (
        <Pressable
          onPress={() => setPicking('city')}
          accessibilityRole="button"
          accessibilityLabel={value.city ? `Ville : ${value.city}. Changer de ville` : 'Choisir la ville'}
          style={styles.select}
        >
          <Text style={[styles.selectValue, !value.city && styles.placeholder]}>
            {value.city || 'Choisir votre ville'}
          </Text>
          <Icon name="solar:alt-arrow-down-linear" size={16} color={colors.mutedForeground} />
        </Pressable>
      ) : (
        <TextInput
          value={value.city}
          onChangeText={(city) => onChange({ ...value, city })}
          placeholder={t('Ville')}
          placeholderTextColor={colors.mutedForeground}
          accessibilityLabel={t('Ville')}
          style={styles.input}
        />
      )}

      <Modal visible={!!picking} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(null)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.cardTitle}>{title}</Text>
            <ScrollView>
              {options.map((option) => {
                const active =
                  (picking === 'country' && option.key === value.country) ||
                  (picking === 'city' && option.key === value.city) ||
                  (picking === 'state' && option.key === value.state);
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => onPick(option.key)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label.replace(/\s+/g, ' ').trim()}
                    accessibilityState={{ selected: active }}
                    style={[styles.row, active && styles.rowActive]}
                  >
                    <Text style={styles.rowLabel}>{option.label}</Text>
                    {active && <Icon name="solar:shield-check-bold" size={18} color={colors.foreground} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  select: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectValue: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
  placeholder: { color: colors.mutedForeground },
  input: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.foreground,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '72%',
    borderRadius: radius['2xl'],
    backgroundColor: colors.card,
    padding: 18,
    gap: 6,
    ...shadow.lg,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.foreground, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  rowActive: { backgroundColor: colors.muted },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.foreground },
});
