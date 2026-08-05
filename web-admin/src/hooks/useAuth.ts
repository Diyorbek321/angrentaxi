'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { AdminUser, authApi } from '@/lib/api';
import { authStorage } from '@/lib/auth';

interface AuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** No token argument: it is set as an httpOnly cookie by /api/auth/login. */
  login: (user: AdminUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useAuthState() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.getMe();
      setUser(data.data);
      authStorage.setUser(data.data);
    } catch {
      authStorage.clearAll();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // The token is no longer visible from here, so the cached profile is the
    // starting point. When it is missing we ask the backend: the request either
    // succeeds on the strength of the session cookie, or 401s and clears up.
    const cached = authStorage.getUser();
    if (cached) {
      setUser(cached);
      setIsLoading(false);
    } else {
      refreshUser().finally(() => setIsLoading(false));
    }
  }, [refreshUser]);

  const login = useCallback((adminUser: AdminUser) => {
    authStorage.setUser(adminUser);
    setUser(adminUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore errors on logout
    } finally {
      authStorage.clearAll();
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };
}
