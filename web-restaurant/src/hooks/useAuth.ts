'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { VendorUser, authApi } from '@/lib/api';
import { authStorage } from '@/lib/auth';

interface AuthContextValue {
  user: VendorUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** No token argument: it is set as an httpOnly cookie by /api/auth/login. */
  login: (user: VendorUser) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: () => {},
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useAuthState() {
  const router = useRouter();
  const [user, setUser] = useState<VendorUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // The token is no longer visible from here — the cached profile is what tells
    // us a session was established. The cookie is the authoritative signal and
    // the middleware is what checks it.
    const cached = authStorage.getUser();
    if (cached) {
      setUser(cached);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((vendorUser: VendorUser) => {
    authStorage.setUser(vendorUser);
    setUser(vendorUser);
  }, []);

  const logout = useCallback(async () => {
    // Awaited so the refresh token is revoked server-side before we navigate —
    // navigating first can cancel the in-flight request and leave it live.
    await authApi.logout();
    authStorage.clearAll();
    setUser(null);
    router.push('/login');
  }, [router]);

  return { user, isLoading, isAuthenticated: !!user, login, logout };
}
