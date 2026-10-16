import React from 'react';
import { LogOut, Menu, Briefcase, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/database';

interface NavbarProps {
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { profile, signOut, activeViewRole, setActiveViewRole } = useAuth();

  const roleLabels: Record<UserRole, string> = {
    employee: 'کارمند',
    manager: 'مدیر فنی / سرپرست',
    ceo: 'مدیرعامل',
  };

  const roleBadgeColors: Record<UserRole, string> = {
    employee: 'bg-slate-100 text-slate-700 border-slate-300',
    manager: 'bg-amber-100 text-amber-800 border-amber-300',
    ceo: 'bg-brand-100 text-brand-800 border-brand-300',
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Right side: Mobile Menu Button & Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
              aria-label="منوی ناوبری"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center text-white font-black text-lg shadow-md shadow-brand-700/20">
                <span>MB</span>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-slate-900 text-base leading-tight">
                  مگابایت سیستم
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  سامانه مدیریت عملکرد و نظارت فنی
                </span>
              </div>
            </div>
          </div>

          {/* Center: Role Switcher (Visible to Manager / CEO) */}
          {profile && (profile.role === 'ceo' || profile.role === 'manager') && (
            <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 px-2 flex items-center gap-1 font-medium">
                <Eye className="w-3.5 h-3.5" />
                <span>نمای فعال:</span>
              </span>

              {profile.role === 'ceo' && (
                <button
                  type="button"
                  onClick={() => setActiveViewRole('ceo')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeViewRole === 'ceo'
                      ? 'bg-white text-brand-800 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  پنل مدیرعامل
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveViewRole('manager')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeViewRole === 'manager'
                    ? 'bg-white text-brand-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                پنل مدیر فنی
              </button>

              <button
                type="button"
                onClick={() => setActiveViewRole('employee')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeViewRole === 'employee'
                    ? 'bg-white text-brand-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                فرم ثبت کارکرد شخصی
              </button>
            </div>
          )}

          {/* Left side: User Profile info & Logout */}
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden sm:flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-800 text-xs sm:text-sm">
                    {profile.full_name}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                      roleBadgeColors[profile.role]
                    }`}
                  >
                    {roleLabels[profile.role]}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                  <Briefcase className="w-3 h-3 text-slate-400" />
                  {profile.department || 'واحد فنی و توسعه'}
                </span>
              </div>
            )}

            <button
              onClick={() => {
                if (window.confirm('آیا مایل به خروج از حساب کاربری خود هستید؟')) {
                  signOut();
                }
              }}
              title="خروج از حساب کاربری"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile View Switcher row if manager/ceo */}
        {profile && (profile.role === 'ceo' || profile.role === 'manager') && (
          <div className="md:hidden flex items-center justify-center gap-1 py-2 border-t border-slate-100 overflow-x-auto">
            {profile.role === 'ceo' && (
              <button
                type="button"
                onClick={() => setActiveViewRole('ceo')}
                className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                  activeViewRole === 'ceo'
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                پنل مدیرعامل
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveViewRole('manager')}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                activeViewRole === 'manager'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              پنل مدیر فنی
            </button>
            <button
              type="button"
              onClick={() => setActiveViewRole('employee')}
              className={`px-3 py-1 text-xs rounded-lg font-semibold transition ${
                activeViewRole === 'employee'
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              فرم ثبت کارکرد
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
