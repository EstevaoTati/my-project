import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/**
 * Turning a camera roll photo into an avatar small enough to store.
 *
 * This exists because of a bug the founder hit: **"Storage Full"**, and profile
 * edits that looked saved until the app was reopened. Both had the same cause.
 *
 * Avatars were encoded straight from the picker at `quality: 0.5` with no
 * resize. A current phone camera produces something like 4000 × 3000; even at
 * half quality that is comfortably over a megabyte, and base64 adds a third
 * again. On web AsyncStorage is localStorage, the whole account roster is one
 * JSON string, and the quota is about 5 MB — so two or three real photos filled
 * it.
 *
 * The second symptom followed from the first. A write that throws part way
 * leaves the in-memory account updated and the stored one not, so the change is
 * visible until the next launch and then gone. Bounding the image fixes both,
 * and `AvatarTooLargeError` gives callers something to say when a picture still
 * will not fit.
 *
 * The avatar is displayed at 96 px at most, so 320 px square covers a 3x screen
 * with room to spare. Anything beyond that was only ever costing storage.
 */

/** Longest edge, in pixels. Generous for a 96 px avatar on a 3x screen. */
const MAX_EDGE = 320;

/** Compression steps to try, in order, until the encoded string fits. */
const QUALITY_STEPS = [0.7, 0.5, 0.35];

/**
 * Ceiling for one encoded avatar, in characters of base64.
 *
 * 220 KB leaves room for a handful of accounts plus their data inside a ~5 MB
 * origin quota. It is a budget, not a technical limit.
 */
export const MAX_AVATAR_CHARS = 220_000;

export class AvatarTooLargeError extends Error {
  constructor() {
    super(
      "Cette image est trop lourde même après compression. Choisissez une photo plus simple ou moins détaillée."
    );
  }
}

/** Options shared by the picker calls. Deliberately no `base64` here. */
export const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  // Full quality out of the picker: the resize below is what controls size, and
  // compressing twice only loses detail for nothing.
  quality: 1,
  // Not requested. Asking the picker for base64 encodes the *original*, which
  // is the megabyte we are trying to avoid ever holding.
  base64: false,
};

/**
 * Resizes and compresses a picked image into a data URI small enough to store.
 *
 * Tries progressively harder compression rather than picking one quality and
 * hoping: a photo of a plain wall and a photo of a market both have to fit, and
 * they compress very differently.
 */
export async function toStorableAvatar(uri: string): Promise<string> {
  let lastError: unknown = null;

  for (const compress of QUALITY_STEPS) {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: MAX_EDGE, height: MAX_EDGE } }],
        { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!result.base64) continue;
      const uriOut = `data:image/jpeg;base64,${result.base64}`;
      if (uriOut.length <= MAX_AVATAR_CHARS) return uriOut;
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError) throw lastError;
  throw new AvatarTooLargeError();
}

/**
 * Picks from the library and returns a storable avatar, or null if cancelled.
 * Throws with a French message the caller can show directly.
 */
export async function pickAvatar(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error("Autorisez l'accès à vos photos pour changer votre image.");
  const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets?.[0]) return null;
  return toStorableAvatar(result.assets[0].uri);
}

/** The same, from the camera. */
export async function captureAvatar(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("Autorisez l'accès à la caméra pour prendre une photo.");
  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets?.[0]) return null;
  return toStorableAvatar(result.assets[0].uri);
}
