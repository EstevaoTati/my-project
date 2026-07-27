import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Bottom sheet used for the secondary actions the design implies but doesn't
 * draw — notifications, city picker, booking confirmation, posting a job.
 *
 * A sheet rather than a full screen because these are all interruptions to the
 * current task, not destinations: you come back to where you were. Tapping the
 * scrim closes, which is the gesture people try first.
 */
export function Sheet({ visible, title, onClose, children }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 8) }]}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={8}
            style={styles.close}
          >
            <Icon name="solar:alt-arrow-down-linear" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingHorizontal: 20,
    paddingTop: 8,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: { fontFamily: fonts.heading, fontSize: 20, color: colors.foreground },
  close: { padding: 4 },
});
