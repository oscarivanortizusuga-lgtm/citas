import React, { createContext, useContext, useMemo } from "react";
import { useParams } from "react-router-dom";

const BusinessContext = createContext(null);

export function BusinessProvider({ children }) {
  const { slug } = useParams();
  const businessSlug = slug || "magicbeautycol";

  const value = useMemo(
    () => ({
      businessSlug,
    }),
    [businessSlug]
  );

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error("useBusiness debe usarse dentro de BusinessProvider");
  }
  return ctx;
}
