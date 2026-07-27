import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabBar } from './components/TabBar';
import { HomeScreen } from './screens/HomeScreen';
import { SearchResultsScreen } from './screens/SearchResultsScreen';
import { ProfessionalProfileScreen } from './screens/ProfessionalProfileScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { SignInScreen } from './screens/SignInScreen';
import { AccountScreen } from './screens/AccountScreen';
import { useAuth } from './auth';
import type { CategoryId } from './data';
import { colors } from './theme';

/**
 * Search and profile live inside the Accueil tab's stack rather than as their
 * own tabs, so the bottom bar stays visible while browsing and "back" returns
 * to where the search began — the flow the design implies.
 */
export type HomeStackParamList = {
  Accueil: undefined;
  Resultats: { category?: CategoryId; query?: string };
  Profil: { id: string };
};

export type AuthStackParamList = {
  Bienvenue: undefined;
  Inscription: undefined;
  Connexion: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator();

function HomeStackScreens() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Accueil" component={HomeScreen} />
      <Stack.Screen name="Resultats" component={SearchResultsScreen} />
      <Stack.Screen name="Profil" component={ProfessionalProfileScreen} />
    </Stack.Navigator>
  );
}

const MissionsScreen = () => (
  <PlaceholderScreen
    title="Missions"
    icon="solar:calendar-mark-linear"
    body="Vos réservations et interventions en cours apparaîtront ici."
  />
);

const MessagesScreen = () => (
  <PlaceholderScreen
    title="Messages"
    icon="solar:chat-round-dots-linear"
    body="Vos échanges avec les professionnels apparaîtront ici."
  />
);

function AppTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Accueil" component={HomeStackScreens} />
      <Tab.Screen name="Missions" component={MissionsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profil" component={AccountScreen} />
    </Tab.Navigator>
  );
}

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Bienvenue" component={WelcomeScreen} />
      <AuthStack.Screen name="Inscription" component={SignUpScreen} />
      <AuthStack.Screen name="Connexion" component={SignInScreen} />
    </AuthStack.Navigator>
  );
}

export function RootNavigator() {
  const { account, restoring } = useAuth();

  // Reading the stored session is fast but not instant. Rendering the welcome
  // screen first and then swapping would flash the sign-up form at someone who
  // is already signed in, so hold on a blank ground until it's known.
  if (restoring) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return account ? <AppTabs /> : <AuthFlow />;
}
