import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState, } from 'react';
import { supabase } from '../lib/supabaseClient';
const AuthContext = createContext(undefined);
const mockAuth = {
    user: { id: 'mock-user', email: 'demo@minerva.ai' },
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
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(supabase ? null : mockAuth.user);
    const [loading, setLoading] = useState(!!supabase);
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
    const signIn = async (email, password) => {
        const client = supabase;
        if (!client)
            return mockAuth.signIn(email, password);
        const { error } = await client.auth.signInWithPassword({ email, password });
        return { error: error?.message };
    };
    const signUp = async (email, password) => {
        const client = supabase;
        if (!client)
            return mockAuth.signUp(email, password);
        const { error } = await client.auth.signUp({ email, password });
        return { error: error?.message };
    };
    const signOut = async () => {
        const client = supabase;
        if (!client)
            return mockAuth.signOut();
        await client.auth.signOut();
    };
    const getAccessToken = async () => {
        const client = supabase;
        if (!client)
            return mockAuth.getAccessToken();
        const { data } = await client.auth.getSession();
        return data.session?.access_token ?? null;
    };
    const value = {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        getAccessToken,
    };
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
