import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Logo } from '../components/Logo';
import { colors, fonts } from '../theme';
import { useT } from '../i18n';

/**
 * Opening sequence: the official mark, then the name, then the app.
 *
 * The founder's correction was specific — show "le logo officiel original de
 * 242Konnect puis le Nom et après la page de s'inscrire ou se connecter, et non
 * simplement le nom « 242Konnect » écrit en texte". So the mark now leads and
 * the wordmark follows it, where before there was only type.
 *
 * The ground is the anthracite the same note asks for, not flat black, with the
 * name in the metallic light grey beside it.
 *
 * Three beats: the mark scales up and fades in, the name reveals letter by
 * letter beneath it, both hold, then the whole thing fades. Around 2.6 s, inside
 * the 2–3 s the directives allow.
 */

const WORD = '242Konnect';

const MARK_IN = 620;
const LETTER_STAGGER = 46;
const LETTER_FADE = 240;
const HOLD = 820;
const FADE_OUT = 380;

type Props = { onDone: () => void };

export function SplashScreen({ onDone }: Props) {
  const t = useT();
  const letters = useMemo(() => WORD.split(''), []);
  const mark = useRef(new Animated.Value(0)).current;
  const progress = useRef(letters.map(() => new Animated.Value(0))).current;
  const exit = useRef(new Animated.Value(1)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const sequence = Animated.sequence([
      Animated.timing(mark, {
        toValue: 1,
        duration: MARK_IN,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.stagger(
        LETTER_STAGGER,
        progress.map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: LETTER_FADE,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ),
      Animated.delay(HOLD),
      Animated.timing(exit, {
        toValue: 0,
        duration: FADE_OUT,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    sequence.start(({ finished }) => {
      if (finished) done.current();
    });

    // If the animation is interrupted — backgrounded mid-splash, or a fast
    // remount — the callback never fires and the app would sit on black
    // forever. This guarantees the handoff.
    const failsafe = setTimeout(() => done.current(), 3600);
    return () => {
      clearTimeout(failsafe);
      sequence.stop();
    };
  }, [mark, progress, exit]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.stack, { opacity: exit }]}>
        <Animated.View
          style={{
            opacity: mark,
            transform: [
              { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
            ],
          }}
        >
          <Logo width={210} label={t('242Konnect')} />
        </Animated.View>

        <View style={styles.word}>
          {letters.map((letter, i) => (
            <Animated.Text
              key={`${letter}-${i}`}
              style={[
                styles.letter,
                {
                  opacity: progress[i],
                  transform: [
                    {
                      translateY: progress[i].interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

/** Total run time, so callers can reason about the handoff without guessing. */
export const SPLASH_DURATION_MS =
  MARK_IN + WORD.length * LETTER_STAGGER + LETTER_FADE + HOLD + FADE_OUT;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // "Noir anthracite premium", not flat black.
    backgroundColor: colors.anthracite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: { alignItems: 'center', gap: 26 },
  word: { flexDirection: 'row' },
  letter: {
    fontFamily: fonts.headingBold,
    fontSize: 30,
    letterSpacing: 0.5,
    // "Gris clair métallique" — the mark carries the colour, the name doesn't
    // compete with it.
    color: colors.metal,
    textShadowColor: 'rgba(233,236,239,0.28)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
});
