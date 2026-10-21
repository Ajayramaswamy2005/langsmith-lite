import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.fetchCurrentUser().then((me) => {
      if (!cancelled) {
        setUser(me);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.loginUser(email, password);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const data = await api.registerUser(email, password, name);
    setUser(data.user);
    return data;
  }, []);

  const googleSignIn = useCallback(async (email, name, avatar) => {
    const data = await api.googleSignIn(email, name, avatar);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    api.logoutUser();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, googleSignIn, logout }),
    [user, ready, login, register, googleSignIn, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
