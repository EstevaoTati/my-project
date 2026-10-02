import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
// Imported per weight, not from the package root: the root re-exports every
// weight and italic, which pulls all 23 font files into the bundle when only
// these six are used (~1.2 MB of dead weight).
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { RootNavigator } from './src/navigation';
import { AppProvider } from './src/store';
import { AuthProvider } from './src/auth';
import { I18nProvider } from './src/i18n';
import { colors } from './src/theme';

/**
 * Make the app fit the *visible* viewport on mobile browsers.
 *
 * The Expo web template sets `height: 100%` on html, body and #root. On a phone
 * that resolves to the large viewport — the one you get with the browser's
 * toolbars retracted — so the bottom of the app sits underneath the address bar
 * or the bottom chrome. The tab bar is the last thing on screen, and its
 * right-most tab is the first casualty: taps land on the browser, not the app.
 *
 * That is the "le bouton Profil ne fonctionne pas" the founder hit on a phone
 * and could not reproduce on a computer, where there is no such chrome.
 *
 * `100dvh` tracks the visible area as the toolbars come and go. The `100%` line
 * stays first as the fallback for browsers without dynamic viewport units, and
 * the safe-area padding keeps the bar clear of the home indicator on iOS.
 */
function useVisibleViewportHeight() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.setAttribute('data-242k', 'viewport');
    style.textContent = `
      html, body, #root { height: 100%; height: 100dvh; }
      body { overscroll-behavior: none; }
      #root { padding-bottom: env(safe-area-inset-bottom, 0px); box-sizing: border-box; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

export default function App() {
  useVisibleViewportHeight();

  // The charte fixes Manrope SemiBold for titles and Inter for text (Regular)
  // and buttons (Medium). Holding the first paint until they load avoids a
  // visible reflow from the system font, most obvious on the large headings.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AuthProvider>
        <AppProvider>
          <NavigationContainer>
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AppProvider>
        </AuthProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
