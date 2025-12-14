import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

const AuthContext = createContext(null);
const TOKEN_KEY = "auth_token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(!!token);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
  }, []);

  const refreshMe = useCallback(
    async (currentToken = token) => {
      if (!currentToken) {
        setUser(null);
        setLoading(false);
        return null;
      }
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
        if (!res.ok) {
          throw new Error("Unauthorized");
        }
        const data = await res.json();
        setUser(data);
        setToken(currentToken);
        localStorage.setItem(TOKEN_KEY, currentToken);
        return data;
      } catch (err) {
        logout();
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, logout]
  );

  const login = useCallback(
    async (username, password) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
          let message = "Credenciales inválidas";
          try {
            const err = await res.json();
            if (err?.message) message = err.message;
          } catch (_) {
            // ignore
          }
          throw new Error(message);
        }
        const data = await res.json();
        const newToken = data?.token;
        if (newToken) {
          localStorage.setItem(TOKEN_KEY, newToken);
          setToken(newToken);
        }
        setUser(data?.user || null);
        return data;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (token) {
      refreshMe().catch(() => {
        // already handled in refreshMe via logout
      });
    } else {
      setLoading(false);
    }
  }, [token, refreshMe]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
