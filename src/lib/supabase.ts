import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ [Megabyte System] تنظیمات اتصال به Supabase یافت نشد یا مقدار پیش‌فرض است. لطفاً فایل .env را طبق .env.example تنظیم نمایید.'
  );
}

// Fallback dummy URL to prevent createClient from throwing an uncaught exception on boot
const validUrl = isSupabaseConfigured ? supabaseUrl : 'https://dummy-megabyte-placeholder.supabase.co';
const validKey = isSupabaseConfigured ? supabaseAnonKey : 'dummy-anon-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
