import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * Opening animation, per the directives.
 *
 * Black ground, the wordmark appearing letter by letter with a faint glow in
 * the brand colours, held briefly, then faded out — 2 to 3 seconds in total.
 * The directives are explicit that the logo must be the only thing on screen,
 * so there is no tagline, spinner or version string here.
 *
 * The wordmark is set in Manrope rather than drawn from a logo file: the brand
 * has no exported logo asset in this repo yet. Dropping a real one in and
 * swapping this Text for an Image is the intended next step — the timing and
 * sequencing below stay as they are.
 */

const WORD = '242Konnect';

/**
 * The mark carries the Congolese flag — green, yellow, red — which is what the
 * brand is named after. The interface charte (black, grey, yellow) is a
 * separate palette and is untouched by this.
 *
 * "242" takes the three colours one digit each; "Konnect" stays white so the
 * flag reads as a mark rather than as rainbow text.
 */
const DIGIT_COLORS = [colors.logoGreen, colors.logoYellow, colors.logoRed];

const LETTER_STAGGER = 55;
const LETTER_FADE = 260;
const HOLD = 1100;
const FADE_OUT = 380;

type Props = { onDone: () => void };

export function SplashScreen({ onDone }: Props) {
  const letters = useMemo(() => WORD.split(''), []);
  // One value per letter, plus one for the whole wordmark's exit.
  const progress = useRef(letters.map(() => new Animated.Value(0))).current;
  const exit = useRef(new Animated.Value(1)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const reveal = Animated.stagger(
      LETTER_STAGGER,
      progress.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: LETTER_FADE,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    );

    const sequence = Animated.sequence([
      reveal,
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
    const failsafe = setTimeout(() => done.current(), 3200);
    return () => {
      clearTimeout(failsafe);
      sequence.stop();
    };
  }, [progress, exit]);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.word, { opacity: exit }]}>
        {letters.map((letter, i) => (
          <Animated.Text
            key={`${letter}-${i}`}
            style={[
              styles.letter,
              i < DIGIT_COLORS.length
                ? { color: DIGIT_COLORS[i], textShadowColor: DIGIT_COLORS[i] }
                : styles.plain,
              {
                opacity: progress[i],
                transform: [
                  {
                    translateY: progress[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {letter}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** Total run time, so callers can reason about the handoff without guessing. */
export const SPLASH_DURATION_MS = WORD.length * LETTER_STAGGER + LETTER_FADE + HOLD + FADE_OUT;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: { flexDirection: 'row' },
  letter: {
    fontFamily: fonts.headingBold,
    fontSize: 38,
    letterSpacing: -0.5,
    // The "léger effet lumineux" the directives ask for — a glow rather than a
    // drop shadow, so it reads as light coming off the mark on black.
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  plain: { color: colors.white, textShadowColor: 'rgba(255,255,255,0.35)' },
});
