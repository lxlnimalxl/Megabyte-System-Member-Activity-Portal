import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthGate } from './components/AuthGate';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { CeoDashboard } from './pages/CeoDashboard';
import { ShieldX, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { user, profile, loading, activeViewRole, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('worklog-form');

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-brand-700 flex items-center justify-center text-white font-black text-xl shadow-lg mb-4 animate-bounce">
          MB
        </div>
        <div className="flex items-center gap-2 text-slate-600 text-sm font-semibold">
          <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
          <span>در حال بررسی نشست و اعتبارسنجی مگابایت سیستم...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Auth Gate
  if (!user || !profile) {
    return <AuthGate />;
  }

  // Account suspended check
  if (!profile.is_active) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-rose-200 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900 mb-2">حساب کاربری غیرفعال است</h2>
          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            دسترسی حساب کاربری شما به سامانه توسط مدیریت غیرفعال شده است. لطفاً جهت فعال‌سازی مجدد با مدیرعامل یا پشتیبانی منابع انسانی شرکت تماس بگیرید.
          </p>
          <button
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
          >
            خروج از حساب
          </button>
        </div>
      </div>
    );
  }

  const handleSelectSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        {/* Right Fixed Sidebar (Desktop) / Slideover (Mobile) */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
        />

        {/* Main Content Area */}
        <main className="flex-1 lg:mr-64 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeViewRole === 'ceo' && profile.role === 'ceo' ? (
            <CeoDashboard />
          ) : activeViewRole === 'manager' && (profile.role === 'ceo' || profile.role === 'manager') ? (
            <ManagerDashboard />
          ) : (
            <EmployeeDashboard />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-4 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700">مگابایت سیستم</span>
            <span>- سامانه جامع پایش عملکرد و مدیریت فعالیت پرسنل</span>
          </div>
          <div className="text-[11px] text-slate-400">
            توسعه‌یافته با استاندارد امنیتی PostgreSQL RLS و تایپ‌استریپت
          </div>
        </div>
      </footer>
    </div>
  );
};
