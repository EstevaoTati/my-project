import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureAvatar, pickAvatar } from '../photo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Icon } from '../components/Icon';
import { UserAvatar } from '../components/Avatar';
import { Field, FormError, SubmitButton } from '../components/form';
import { Sheet } from '../components/Sheet';
import { useAuth } from '../auth';
import { trades } from '../data';
import type { AccountStackParamList } from '../navigation';
import { colors, fonts, radius, shadow } from '../theme';
import { useT } from '../i18n';

type Props = NativeStackScreenProps<AccountStackParamList, 'ModifierProfil'>;

export function EditProfileScreen({ navigation }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { account, updateProfile } = useAuth();

  const [name, setName] = useState(account?.name ?? '');
  const [bio, setBio] = useState(account?.bio ?? '');
  const [tradeId, setTradeId] = useState(account?.prestataire?.tradeId);
  const [avatar, setAvatar] = useState(account?.avatar);
  const [showTrades, setShowTrades] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;
  const isPro = account.profiles.includes('prestataire');

  /**
   * Both pickers go through `photo.ts`, which resizes and compresses before
   * encoding. Storing the picker's own output filled the device's quota after a
   * couple of photos and took profile saving down with it.
   */
  const choose = async (take: () => Promise<string | null>) => {
    setError(null);
    setPicking(true);
    try {
      const next = await take();
      if (next) setAvatar(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'utiliser cette image.");
    } finally {
      setPicking(false);
    }
  };

  const pickFromLibrary = () => choose(pickAvatar);
  const takePhoto = () => choose(captureAvatar);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      // The trade lives on the prestataire profile, so merge rather than
      // replace — otherwise saving the name would wipe the rest of it.
      await updateProfile({
        name,
        bio,
        avatar,
        ...(account.prestataire && tradeId
          ? { prestataire: { ...account.prestataire, tradeId } }
          : {}),
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const selectedTrade = trades.find((t) => t.id === tradeId);

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
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

        <Text style={styles.title}>{t('Modifier le profil')}</Text>

        <View style={styles.photoBlock}>
          <UserAvatar name={name || account.name} avatar={avatar} size={96} border={colors.primary} />
          <View style={styles.photoActions}>
            <Pressable
              onPress={pickFromLibrary}
              accessibilityRole="button"
              accessibilityLabel={t('Choisir une photo')}
              style={styles.photoButton}
            >
              <Icon name="solar:add-square-bold" size={18} color={colors.primary} />
              <Text style={styles.photoButtonLabel}>{t('Galerie')}</Text>
            </Pressable>
            <Pressable
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel={t('Prendre une photo')}
              style={styles.photoButton}
            >
              <Icon name="solar:monitor-smartphone-bold-duotone" size={18} color={colors.primary} />
              <Text style={styles.photoButtonLabel}>{t('Caméra')}</Text>
            </Pressable>
            {!!avatar && (
              <Pressable
                onPress={() => setAvatar(undefined)}
                accessibilityRole="button"
                accessibilityLabel={t('Retirer la photo')}
                style={styles.photoButton}
              >
                <Icon name="solar:heart-linear" size={18} color={colors.destructive} />
                <Text style={[styles.photoButtonLabel, styles.removeLabel]}>{t('Retirer')}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.form}>
          <Field label={t('Nom complet')} value={name} onChangeText={setName} autoCapitalize="words" />

          <View style={styles.readonly}>
            <Text style={styles.readonlyLabel}>{t('Numéro de téléphone')}</Text>
            <Text style={styles.readonlyValue}>+242 {account.phone}</Text>
            <Text style={styles.readonlyHint}>{t('Votre numéro est votre identifiant et ne peut pas être modifié ici.')}</Text>
          </View>

          {isPro && (
            <View style={styles.field}>
              <Text style={styles.label}>{t('Votre métier')}</Text>
              <Pressable
                onPress={() => setShowTrades(true)}
                accessibilityRole="button"
                accessibilityLabel={t('Choisir votre métier')}
                style={styles.select}
              >
                <Text style={[styles.selectValue, !selectedTrade && styles.selectPlaceholder]}>
                  {selectedTrade?.label ?? 'Choisir un métier'}
                </Text>
                <Icon name="solar:alt-arrow-down-linear" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          <Field
            label={t('À propos de vous')}
            value={bio}
            onChangeText={setBio}
            placeholder={isPro ? 'Décrivez votre expérience et vos services' : 'Quelques mots sur vous'}
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />

          <FormError message={error} />
          <SubmitButton label={t('Enregistrer')} onPress={save} busy={busy} accessibilityLabel={t('Enregistrer le profil')} />
        </View>
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
            accessibilityState={{ selected: trade.id === tradeId }}
            style={[styles.tradeRow, trade.id === tradeId && styles.tradeRowSelected]}
          >
            <Text style={styles.tradeLabel}>{trade.label}</Text>
            <Text style={styles.tradeDesc} numberOfLines={2}>
              {trade.description}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, gap: 16 },
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
  photoBlock: { alignItems: 'center', gap: 12 },
  photoActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
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
  removeLabel: { color: colors.destructive },
  form: { gap: 14 },
  field: { gap: 6 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  textarea: { height: 100, paddingTop: 14, textAlignVertical: 'top' },
  readonly: {
    padding: 14,
    borderRadius: radius.xl,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  readonlyLabel: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.foreground },
  readonlyValue: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.foreground },
  readonlyHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
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
  tradeRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 2,
  },
  tradeRowSelected: { borderColor: colors.primary, backgroundColor: colors.muted },
  tradeLabel: { fontFamily: fonts.sansSemibold, fontSize: 14, color: colors.foreground },
  tradeDesc: { fontFamily: fonts.sans, fontSize: 12, color: colors.mutedForeground },
});
