'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { VendorUser } from '@/lib/api';
import { authStorage } from '@/lib/auth';

interface AuthContextValue {
  user: VendorUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user: VendorUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useAuthState() {
  const router = useRouter();
  const [user, setUser] = useState<VendorUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = authStorage.getToken();
    const cached = authStorage.getUser();
    if (token && cached) {
      setUser(cached);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((token: string, vendorUser: VendorUser) => {
    authStorage.setToken(token);
    authStorage.setUser(vendorUser);
    setUser(vendorUser);
  }, []);

  const logout = useCallback(() => {
    authStorage.clearAll();
    setUser(null);
    router.push('/login');
  }, [router]);

  return { user, isLoading, isAuthenticated: !!user, login, logout };
}
