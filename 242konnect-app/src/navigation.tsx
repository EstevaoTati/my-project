import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabBar } from './components/TabBar';
import { HomeScreen } from './screens/HomeScreen';
import { SearchResultsScreen } from './screens/SearchResultsScreen';
import { ProfessionalProfileScreen } from './screens/ProfessionalProfileScreen';
import { TradesScreen } from './screens/TradesScreen';
import { MissionsScreen } from './screens/MissionsScreen';
import { MessagesScreen } from './screens/MessagesScreen';
import { ChatScreen } from './screens/ChatScreen';
import { AccountScreen } from './screens/AccountScreen';
import { EditProfileScreen } from './screens/EditProfileScreen';
import { FaqScreen } from './screens/FaqScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { SignInScreen } from './screens/SignInScreen';
import { SplashScreen } from './screens/SplashScreen';
import { useAuth } from './auth';
import type { CategoryId } from './data';
import { colors } from './theme';

/**
 * Each tab owns a stack, so pushing a detail screen keeps the bottom bar in
 * place and "back" returns to where you were rather than to a tab root.
 */
export type HomeStackParamList = {
  Accueil: undefined;
  Metiers: { category?: CategoryId } | undefined;
  Resultats: { category?: CategoryId; tradeId?: string; query?: string };
  Profil: { id: string };
};

export type MessagesStackParamList = {
  Conversations: undefined;
  Discussion: { id: string };
};

export type AccountStackParamList = {
  MonCompte: undefined;
  ModifierProfil: undefined;
  FAQ: undefined;
};

export type AuthStackParamList = {
  Bienvenue: undefined;
  Inscription: undefined;
  Connexion: undefined;
};

const Home = createNativeStackNavigator<HomeStackParamList>();
const Messages = createNativeStackNavigator<MessagesStackParamList>();
const Account = createNativeStackNavigator<AccountStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator();

const hidden = { headerShown: false } as const;

function HomeStackScreens() {
  return (
    <Home.Navigator screenOptions={hidden}>
      <Home.Screen name="Accueil" component={HomeScreen} />
      <Home.Screen name="Metiers" component={TradesScreen} />
      <Home.Screen name="Resultats" component={SearchResultsScreen} />
      <Home.Screen name="Profil" component={ProfessionalProfileScreen} />
    </Home.Navigator>
  );
}

function MessagesStackScreens() {
  return (
    <Messages.Navigator screenOptions={hidden}>
      <Messages.Screen name="Conversations" component={MessagesScreen} />
      <Messages.Screen name="Discussion" component={ChatScreen} />
    </Messages.Navigator>
  );
}

function AccountStackScreens() {
  return (
    <Account.Navigator screenOptions={hidden}>
      <Account.Screen name="MonCompte" component={AccountScreen} />
      <Account.Screen name="ModifierProfil" component={EditProfileScreen} />
      <Account.Screen name="FAQ" component={FaqScreen} />
    </Account.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator screenOptions={hidden} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Accueil" component={HomeStackScreens} />
      <Tab.Screen name="Missions" component={MissionsScreen} />
      <Tab.Screen name="Messages" component={MessagesStackScreens} />
      <Tab.Screen name="Profil" component={AccountStackScreens} />
    </Tab.Navigator>
  );
}

/**
 * The directives split the unauthenticated entry point in two: the very first
 * open lands on "Commencer" (Bienvenue), which introduces the platform; every
 * later open goes straight to Connexion. Same stack, different starting screen.
 */
function AuthFlow({ firstLaunch }: { firstLaunch: boolean }) {
  return (
    <AuthStack.Navigator screenOptions={hidden} initialRouteName={firstLaunch ? 'Bienvenue' : 'Connexion'}>
      <AuthStack.Screen name="Bienvenue" component={WelcomeScreen} />
      <AuthStack.Screen name="Inscription" component={SignUpScreen} />
      <AuthStack.Screen name="Connexion" component={SignInScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { account, restoring, firstLaunch, markLaunched } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  // Captured before markLaunched clears it, so the routing decision isn't
  // changed underneath the navigator by its own side effect.
  const wasFirstLaunch = useRef(false);

  const finishSplash = useCallback(() => {
    wasFirstLaunch.current = firstLaunch;
    markLaunched();
    setSplashDone(true);
  }, [firstLaunch, markLaunched]);

  // The splash runs while the stored session is being read, so the animation
  // covers the restore instead of adding to it.
  if (!splashDone) return <SplashScreen onDone={finishSplash} />;

  // Restoring is normally finished by the time the splash ends; if it isn't,
  // hold on the same black ground rather than flashing the sign-in form at
  // someone who is already signed in.
  if (restoring) return <View style={{ flex: 1, backgroundColor: colors.black }} />;

  return account ? <AppTabs /> : <AuthFlow firstLaunch={wasFirstLaunch.current} />;
}
