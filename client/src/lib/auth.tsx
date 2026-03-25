'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  auctionResults?: any[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (name: string, email: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  setToken: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const setToken = (newToken: string) => {
    setTokenState(newToken);
    localStorage.setItem('auction_token', newToken);
  };

  useEffect(() => {
    const stored = localStorage.getItem('auction_token');
    if (stored) {
      setTokenState(stored);
      api.getMe(stored)
        .then((data) => setUser(data.user))
        .catch(() => {
          localStorage.removeItem('auction_token');
          setTokenState(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (name: string, email: string) => {
    const data = await api.devLogin(name, email);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    setUser(null);
    setTokenState(null);
    localStorage.removeItem('auction_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
