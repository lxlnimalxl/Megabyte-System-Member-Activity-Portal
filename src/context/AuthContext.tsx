import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile, UserRole } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  activeViewRole: UserRole;
  setActiveViewRole: (role: UserRole) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, department: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeViewRole, setActiveViewRoleState] = useState<UserRole>('employee');

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (data) {
        const fetchedProfile = data as Profile;
        setProfile(fetchedProfile);
        setActiveViewRoleState(fetchedProfile.role);
        return fetchedProfile;
      }
      return null;
    } catch (err) {
      console.error('Fetch profile unexpected error:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  }, [user?.id, fetchProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const setActiveViewRole = (newRole: UserRole) => {
    if (!profile) return;
    // Strict privilege guard: Employees cannot elevate activeViewRole
    if (profile.role === 'employee' && newRole !== 'employee') {
      return;
    }
    // Managers can only view manager or employee
    if (profile.role === 'manager' && newRole === 'ceo') {
      return;
    }
    setActiveViewRoleState(newRole);
  };

  const mapAuthErrorToPersian = (msg: string): string => {
    const lower = msg.toLowerCase();
    if (lower.includes('invalid login credentials')) {
      return 'اطلاعات ورود (ایمیل یا رمز عبور) اشتباه است.';
    }
    if (lower.includes('user already registered')) {
      return 'کاربری با این ایمیل قبلاً در سامانه ثبت نام شده است.';
    }
    if (lower.includes('password should be at least')) {
      return 'رمز عبور باید حداقل ۶ نویسه (کاراکتر) باشد.';
    }
    if (lower.includes('invalid email')) {
      return 'فرمت نشانی ایمیل وارد شده نامعتبر است.';
    }
    if (lower.includes('network') || lower.includes('fetch')) {
      return 'خطا در برقراری ارتباط با پایگاه داده. لطفاً اینترنت یا کلیدهای اتصال را بررسی کنید.';
    }
    return msg;
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'اتصال به پایگاه داده Supabase تنظیم نشده است. لطفاً فایل .env را تنظیم کنید.' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: mapAuthErrorToPersian(error.message) };
      }

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطای غیرمنتظره در ورود به سامانه';
      return { error: mapAuthErrorToPersian(message) };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    department: string
  ): Promise<{ error: string | null }> => {
    if (!isSupabaseConfigured) {
      return { error: 'اتصال به پایگاه داده Supabase تنظیم نشده است. لطفاً فایل .env را تنظیم کنید.' };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            department: department.trim(),
          },
        },
      });

      if (error) {
        return { error: mapAuthErrorToPersian(error.message) };
      }

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'خطای غیرمنتظره در ثبت نام';
      return { error: mapAuthErrorToPersian(message) };
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setActiveViewRoleState('employee');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        activeViewRole,
        setActiveViewRole,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
