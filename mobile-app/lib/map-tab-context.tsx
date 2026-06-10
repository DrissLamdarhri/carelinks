import React, { createContext, useContext, useState, ReactNode } from "react";

type MapTabContextValue = {
  showMap: boolean;
  setShowMap: (v: boolean) => void;
};

const MapTabContext = createContext<MapTabContextValue>({
  showMap: false,
  setShowMap: () => {},
});

export function MapTabProvider({ children }: { children: ReactNode }) {
  const [showMap, setShowMap] = useState(false);
  return <MapTabContext.Provider value={{ showMap, setShowMap }}>{children}</MapTabContext.Provider>;
}

export function useMapTab() {
  return useContext(MapTabContext);
}
