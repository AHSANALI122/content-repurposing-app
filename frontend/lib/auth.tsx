"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import * as api from "@/lib/api";
import type { User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if a token exists, hydrate the user via /me.
  useEffect(() => {
    let active = true;
    async function hydrate() {
      if (!api.getToken()) {
        setLoading(false);
        return;
      }
      try {
        const u = await api.me();
        if (active) setUser(u);
      } catch {
        api.clearToken();
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    hydrate();
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const { access_token } = await api.login(email, password);
    api.setToken(access_token);
    setUser(await api.me());
  }

  async function register(email: string, password: string) {
    const { access_token } = await api.register(email, password);
    api.setToken(access_token);
    setUser(await api.me());
  }

  function logout() {
    api.clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
