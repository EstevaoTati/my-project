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
import * as ImagePicker from 'expo-image-picker';
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

type Props = NativeStackScreenProps<AccountStackParamList, 'ModifierProfil'>;

/**
 * Profile photos are stored inside the account record as a data URI, so they
 * have to stay small — AsyncStorage is not a filesystem. 512 px at 0.5 quality
 * is plenty for a 52 px avatar and keeps the encoded string well under the
 * point where writes start to hurt.
 */
const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.5,
  base64: true,
};

export function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { account, updateProfile } = useAuth();

  const [name, setName] = useState(account?.name ?? '');
  const [bio, setBio] = useState(account?.bio ?? '');
  const [tradeId, setTradeId] = useState(account?.prestataire?.tradeId);
  const [avatar, setAvatar] = useState(account?.avatar);
  const [showTrades, setShowTrades] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;
  const isPro = account.profiles.includes('prestataire');

  const useResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    // base64 comes back without the prefix; an <Image> needs the full data URI.
    if (asset.base64) setAvatar(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    else if (asset.uri) setAvatar(asset.uri);
  };

  const pickFromLibrary = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Autorisez l'accès aux photos pour choisir une image.");
      return;
    }
    useResult(await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS));
  };

  const takePhoto = async () => {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Autorisez l'accès à la caméra pour prendre une photo.");
      return;
    }
    useResult(await ImagePicker.launchCameraAsync(IMAGE_OPTIONS));
  };

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
          accessibilityLabel="Retour"
          hitSlop={8}
          style={styles.back}
        >
          <Icon name="solar:alt-arrow-left-linear" size={24} color={colors.foreground} />
        </Pressable>

        <Text style={styles.title}>Modifier le profil</Text>

        <View style={styles.photoBlock}>
          <UserAvatar name={name || account.name} avatar={avatar} size={96} border={colors.primary} />
          <View style={styles.photoActions}>
            <Pressable
              onPress={pickFromLibrary}
              accessibilityRole="button"
              accessibilityLabel="Choisir une photo"
              style={styles.photoButton}
            >
              <Icon name="solar:add-square-bold" size={18} color={colors.primary} />
              <Text style={styles.photoButtonLabel}>Galerie</Text>
            </Pressable>
            <Pressable
              onPress={takePhoto}
              accessibilityRole="button"
              accessibilityLabel="Prendre une photo"
              style={styles.photoButton}
            >
              <Icon name="solar:monitor-smartphone-bold-duotone" size={18} color={colors.primary} />
              <Text style={styles.photoButtonLabel}>Caméra</Text>
            </Pressable>
            {!!avatar && (
              <Pressable
                onPress={() => setAvatar(undefined)}
                accessibilityRole="button"
                accessibilityLabel="Retirer la photo"
                style={styles.photoButton}
              >
                <Icon name="solar:heart-linear" size={18} color={colors.destructive} />
                <Text style={[styles.photoButtonLabel, styles.removeLabel]}>Retirer</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.form}>
          <Field label="Nom complet" value={name} onChangeText={setName} autoCapitalize="words" />

          <View style={styles.readonly}>
            <Text style={styles.readonlyLabel}>Numéro de téléphone</Text>
            <Text style={styles.readonlyValue}>+242 {account.phone}</Text>
            <Text style={styles.readonlyHint}>
              Votre numéro est votre identifiant et ne peut pas être modifié ici.
            </Text>
          </View>

          {isPro && (
            <View style={styles.field}>
              <Text style={styles.label}>Votre métier</Text>
              <Pressable
                onPress={() => setShowTrades(true)}
                accessibilityRole="button"
                accessibilityLabel="Choisir votre métier"
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
            label="À propos de vous"
            value={bio}
            onChangeText={setBio}
            placeholder={isPro ? 'Décrivez votre expérience et vos services' : 'Quelques mots sur vous'}
            multiline
            numberOfLines={4}
            style={styles.textarea}
          />

          <FormError message={error} />
          <SubmitButton label="Enregistrer" onPress={save} busy={busy} accessibilityLabel="Enregistrer le profil" />
        </View>
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
