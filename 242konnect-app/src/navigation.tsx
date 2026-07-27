import React from 'react';
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

function AuthFlow() {
  return (
    <AuthStack.Navigator screenOptions={hidden}>
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
