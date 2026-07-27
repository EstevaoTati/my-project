import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Small app-wide store.
 *
 * Favourites have to be shared: the heart on a search result and the heart on
 * that professional's profile are the same fact, and letting each screen keep
 * its own copy makes them disagree the moment you tap one and navigate to the
 * other. The chosen city lives here for the same reason — the header shows it
 * and the results screen will eventually filter on it.
 *
 * This is in-memory only, so it resets when the app is killed. Persisting it is
 * a job for the backend (or AsyncStorage), not something to fake here.
 */

export const CITIES = ['Pointe-Noire, Rép. du Congo', 'Brazzaville, Rép. du Congo'] as const;
export type City = (typeof CITIES)[number];

type Store = {
  favorites: Record<string, boolean>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  favoriteCount: number;
  city: City;
  setCity: (city: City) => void;
};

const AppContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [city, setCity] = useState<City>(CITIES[0]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      favorites,
      isFavorite: (id) => !!favorites[id],
      toggleFavorite,
      favoriteCount: Object.values(favorites).filter(Boolean).length,
      city,
      setCity,
    }),
    [favorites, toggleFavorite, city]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useStore must be used inside <AppProvider>');
  return ctx;
}
