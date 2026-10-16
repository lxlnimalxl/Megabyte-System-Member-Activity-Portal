import React from 'react';
import {
  FileText,
  CheckSquare,
  History,
  AlertOctagon,
  ClipboardCheck,
  PlusCircle,
  FolderKanban,
  BarChart3,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  X,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  activeSection,
  onSelectSection,
}) => {
  const { activeViewRole, profile } = useAuth();

  const employeeNav: NavItem[] = [
    { id: 'worklog-form', label: 'ثبت کارکرد روزانه', icon: FileText },
    { id: 'assigned-tasks', label: 'تسک‌های محول شده به من', icon: CheckSquare },
    { id: 'log-history', label: 'سوابق گزارش‌ها و پاسخ مدیر', icon: History },
  ];

  const managerNav: NavItem[] = [
    { id: 'blocker-center', label: 'رسیدگی به موانع کاری', icon: AlertOctagon, highlight: true },
    { id: 'review-queue', label: 'صف تایید گزارش‌های پرسنل', icon: ClipboardCheck },
    { id: 'assign-task', label: 'تخصیص تسک جدید', icon: PlusCircle },
    { id: 'projects-mgmt', label: 'پایش و کنترل پروژه‌ها', icon: FolderKanban },
  ];

  const ceoNav: NavItem[] = [
    { id: 'kpi-section', label: 'شاخص‌های کلیدی (KPI)', icon: BarChart3 },
    { id: 'comparison-section', label: 'تحلیل مقایسه‌ای پرسنل', icon: Users },
    { id: 'users-mgmt', label: 'مدیریت پرسنل و دسترسی‌ها', icon: ShieldCheck },
    { id: 'projects-overview', label: 'پیشرفت کل پروژه‌ها', icon: FolderKanban },
    { id: 'export-section', label: 'خروجی اکسل و سوابق', icon: FileSpreadsheet },
  ];

  const currentNav =
    activeViewRole === 'ceo' ? ceoNav : activeViewRole === 'manager' ? managerNav : employeeNav;

  const roleTitle =
    activeViewRole === 'ceo'
      ? 'منوی مدیریت ارشد'
      : activeViewRole === 'manager'
      ? 'منوی نظارت فنی'
      : 'منوی کارمند فنی';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-64 bg-white border-l border-slate-200 shadow-xl lg:shadow-none transition-transform duration-300 transform lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        } flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100">
          <div className="flex items-center gap-2 text-brand-800 font-extrabold text-sm">
            <Building2 className="w-5 h-5 text-brand-600" />
            <span>{roleTitle}</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            بخش‌های دسترسی سریع
          </div>

          {currentNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive
                        ? 'text-white'
                        : item.highlight
                        ? 'text-rose-600'
                        : 'text-slate-500'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="text-xs text-slate-500 font-medium">
            <div className="text-[11px] text-slate-400">کاربر فعال:</div>
            <div className="font-bold text-slate-700 truncate">{profile?.full_name}</div>
            <div className="text-[10px] text-slate-400 truncate">{profile?.email}</div>
          </div>
        </div>
      </aside>
    </>
  );
};
