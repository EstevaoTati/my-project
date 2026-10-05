import React, { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

/**
 * A row of digit boxes with one real input laid over them.
 *
 * The boxes are the affordance; the field underneath is what actually accepts
 * typing, pasting and SMS autofill. It stays full size and focusable rather
 * than collapsed to zero height — a hidden input is hidden from assistive
 * technology as well as from the eye.
 *
 * Shared by the e-mail code and the PIN because they are the same control with
 * different stakes: `secure` swaps the digits for dots, which is right for a
 * PIN someone reuses and wrong for a code read off a screen and discarded.
 */
type Props = {
  value: string;
  onChange: (next: string) => void;
  length: number;
  label: string;
  /** Render dots instead of digits. */
  secure?: boolean;
  autoFocus?: boolean;
  /** Fires when the last digit lands, which is what people expect here. */
  onComplete?: (value: string) => void;
  /** `oneTimeCode` helps the OS offer a mailed code; wrong for a chosen PIN. */
  oneTimeCode?: boolean;
};

export function CodeField({
  value,
  onChange,
  length,
  label,
  secure = false,
  autoFocus = false,
  onComplete,
  oneTimeCode = false,
}: Props) {
  const input = useRef<TextInput>(null);

  const handle = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.boxes} importantForAccessibility="no-hide-descendants">
        {Array.from({ length }).map((_, i) => (
          <View key={i} style={[styles.box, i === value.length && styles.boxActive]}>
            <Text style={[styles.digit, secure && styles.dot]}>
              {value[i] === undefined ? '' : secure ? '•' : value[i]}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={handle}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        secureTextEntry={secure}
        {...(oneTimeCode ? { textContentType: 'oneTimeCode' as const, autoComplete: 'sms-otp' as const } : {})}
        accessibilityLabel={label}
        style={styles.overlay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  boxes: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    fontSize: 22,
    textAlign: 'center',
  },
  box: {
    flex: 1,
    height: 58,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.foreground },
  digit: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.foreground },
  dot: { fontSize: 28, lineHeight: 32 },
});
