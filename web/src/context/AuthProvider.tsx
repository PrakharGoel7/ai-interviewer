import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const mockAuth: AuthContextValue = {
  user: { id: 'mock-user', email: 'demo@minerva.ai' } as User,
  session: null,
  loading: false,
  async signIn() {
    return { error: 'Supabase not configured' };
  },
  async signUp() {
    return { error: 'Supabase not configured' };
  },
  async signOut() {
    // no-op
  },
  async getAccessToken() {
    return 'mock-token';
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(supabase ? null : mockAuth.user);
  const [loading, setLoading] = useState<boolean>(!!supabase);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    const fetchSession = async () => {
      const { data } = await client.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    fetchSession();

    const { data: listener } = client.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const client = supabase;
    if (!client) return mockAuth.signIn(email, password);
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signUp: AuthContextValue['signUp'] = async (email, password) => {
    const client = supabase;
    if (!client) return mockAuth.signUp(email, password);
    const { error } = await client.auth.signUp({ email, password });
    return { error: error?.message };
  };

  const signOut = async () => {
    const client = supabase;
    if (!client) return mockAuth.signOut();
    await client.auth.signOut();
  };

  const getAccessToken = async () => {
    const client = supabase;
    if (!client) return mockAuth.getAccessToken();
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    getAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
