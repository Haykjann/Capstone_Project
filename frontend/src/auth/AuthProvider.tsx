import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { api } from '../api';
import { AuthResponse, ProfileResponse, User } from './types';

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { orgName: string; fullName: string; email: string; password: string }) => Promise<void>;
  verify: (data: { email: string; code: string }) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);

  const setSession = useCallback((token: string, profile: ProfileResponse) => {
    setAccessToken(token);
    setUser(profile.user);
  }, []);

  const fetchProfile = useCallback(async (token: string) => {
    const res = await api.get<ProfileResponse>('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    setUser(res.data.user);
    return res.data;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      const token = res.data.accessToken;
      const profileRes = await fetchProfile(token);
      setSession(token, profileRes);
    },
    [fetchProfile, setSession],
  );

  const register = useCallback(
    async (data: { orgName: string; fullName: string; email: string; password: string }) => {
      await api.post('/auth/register', data);
    },
    [],
  );

  const verify = useCallback(
    async (data: { email: string; code: string }) => {
      const res = await api.post<AuthResponse>('/auth/verify', data);
      const token = res.data.accessToken;
      const profileRes = await fetchProfile(token);
      setSession(token, profileRes);
    },
    [fetchProfile, setSession],
  );

  const resendCode = useCallback(async (email: string) => {
    await api.post('/auth/resend-code', { email });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await api.post<AuthResponse>('/auth/refresh');
    const token = res.data.accessToken;
    const profileRes = await fetchProfile(token);
    setSession(token, profileRes);
  }, [fetchProfile, setSession]);

  useEffect(() => {
    // Guard against React StrictMode double-invocation: two concurrent refresh
    // calls would cause the second to hit a revoked token and log the user out.
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const bootstrap = async () => {
      try {
        await refresh();
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      register,
      verify,
      resendCode,
      logout,
      refresh,
    }),
    [user, accessToken, loading, login, register, verify, resendCode, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
