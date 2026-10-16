import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  Mail,
  User,
  Building,
  Sparkles,
  KeyRound,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { useToast } from '../context/ToastContext';

export const AuthGate: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('فنی و توسعه نرم‌افزار');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('لطفاً ایمیل و رمز عبور را وارد کنید.');
      return;
    }

    if (mode === 'signup' && !fullName.trim()) {
      setErrorMessage('لطفاً نام و نام خانوادگی خود را وارد کنید.');
      return;
    }

    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) {
        setErrorMessage(error);
        showToast(error, 'error');
      } else {
        showToast('با موفقیت وارد شدید.', 'success');
      }
    } else {
      const { error } = await signUp(email, password, fullName, department);
      if (error) {
        setErrorMessage(error);
        showToast(error, 'error');
      } else {
        showToast('ثبت نام با موفقیت انجام شد و وارد شدید.', 'success');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-brand-500 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-800 to-brand-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-brand-700/25 border-2 border-white/20">
            <span>MB</span>
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            مگابایت سیستم
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            سامانه یکپارچه مدیریت عملکرد پرسنل و نظارت پروژه
          </p>
        </div>

        {/* Warning if Supabase is not yet configured */}
        {!isSupabaseConfigured && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-sm">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-sm">توجه: تنظیمات اتصال به Supabase نیازمند مقداردهی است</span>
                <p className="text-amber-800 leading-relaxed">
                  متغیرهای محیطی <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">VITE_SUPABASE_URL</code> و <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">VITE_SUPABASE_ANON_KEY</code> را در فایل <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">.env</code> طبق راهنمای <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-950 font-mono">.env.example</code> قرار دهید.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="mt-6 bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl sm:px-10 border border-slate-200/80">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'login'
                  ? 'bg-white text-brand-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ورود به سامانه
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                mode === 'signup'
                  ? 'bg-white text-brand-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ثبت نام عضو جدید
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium leading-relaxed">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام و نام خانوادگی
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="مثال: علی رضایی"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pr-10 pl-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    دپارتمان / واحد سازمانی
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full pr-10 pl-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white"
                    >
                      <option value="فنی و توسعه نرم‌افزار">فنی و توسعه نرم‌افزار</option>
                      <option value="تیم بک‌اند و دیتابیس">تیم بک‌اند و دیتابیس</option>
                      <option value="تیم فرانت‌اند و رابط کاربری">تیم فرانت‌اند و رابط کاربری</option>
                      <option value="دوآپس و امنیت شبکه">دوآپس و امنیت شبکه</option>
                      <option value="تست و تضمین کیفیت (QA)">تست و تضمین کیفیت (QA)</option>
                      <option value="مدیریت محصول و پروژه">مدیریت محصول و پروژه</option>
                      <option value="پشتیبانی فنی و هلپ‌دسک">پشتیبانی فنی و هلپ‌دسک</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نشانی ایمیل سازمانی
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="name@megabyte.ir"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رمز عبور
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="حداقل ۶ کاراکتر"
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-left"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-md shadow-brand-600/30 transition active:scale-[0.99] disabled:opacity-50"
            >
              {loading ? (
                <span>در حال پردازش...</span>
              ) : mode === 'login' ? (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>ورود به سامانه</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>تکمیل ثبت نام</span>
                </>
              )}
            </button>
          </form>

          {/* Role info reminder */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-start gap-2 text-slate-500 text-[11px] leading-relaxed">
            <Info className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
            <span>
              نکته امنیتی: اولین کاربری که در پایگاه داده ثبت نام کند، به‌طور خودکار به عنوان <strong>مدیرعامل (CEO)</strong> تعیین می‌گردد. ثبت نام‌های بعدی نقش پیش‌فرض <strong>کارمند</strong> خواهند داشت.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
