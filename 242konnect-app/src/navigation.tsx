import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { TabBar } from './components/TabBar';
import { HomeScreen } from './screens/HomeScreen';
import { SearchResultsScreen } from './screens/SearchResultsScreen';
import { ProfessionalProfileScreen } from './screens/ProfessionalProfileScreen';
import { PlaceholderScreen } from './screens/PlaceholderScreen';
import type { CategoryId } from './data';

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

const Stack = createNativeStackNavigator<HomeStackParamList>();
const Tab = createBottomTabNavigator();

function HomeStack() {
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

const ProfilScreen = () => (
  <PlaceholderScreen
    title="Profil"
    icon="solar:user-rounded-linear"
    body="Votre compte, vos favoris et vos moyens de paiement."
  />
);

export function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Accueil" component={HomeStack} />
      <Tab.Screen name="Missions" component={MissionsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}
