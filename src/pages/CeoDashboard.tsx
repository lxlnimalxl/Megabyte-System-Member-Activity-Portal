import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  Clock,
  CheckCircle2,
  AlertOctagon,
  FolderKanban,
  UserCheck,
  UserX,
  TrendingUp,
  RefreshCw,
  Search,
  Sliders,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import type { WorkLog, Project, Profile, AssignedTask, UserRole } from '../types/database';
import { formatPersianDate, formatDuration, toPersianDigits, getTodayIsoDate } from '../utils/date';
import { exportWorkLogsToCsv } from '../utils/exportCsv';

interface EmployeePerformanceMetric {
  profile: Profile;
  totalMinutes: number;
  logsCount: number;
  approvedCount: number;
  blockersCount: number;
  completedTasksCount: number;
}

export const CeoDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);

  // Search & filter for user management
  const [userSearch, setUserSearch] = useState('');
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  const fetchCeoData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch profiles
      const { data: profs, error: profsError } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true })
        .order('full_name', { ascending: true });

      if (profsError) throw profsError;
      setProfiles((profs as Profile[]) || []);

      // 2. Fetch all work logs with relationships
      const { data: logs, error: logsError } = await supabase
        .from('work_logs')
        .select(`
          *,
          profiles:user_id (id, full_name, department, email),
          projects:project_id (id, name, progress),
          reviewer:reviewed_by (full_name)
        `)
        .order('work_date', { ascending: false });

      if (logsError) throw logsError;
      setWorkLogs((logs as unknown as WorkLog[]) || []);

      // 3. Fetch projects
      const { data: projs, error: projsError } = await supabase
        .from('projects')
        .select('*')
        .order('progress', { ascending: false });

      if (projsError) throw projsError;
      setProjects((projs as Project[]) || []);

      // 4. Fetch assigned tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('assigned_tasks')
        .select('*');

      if (tasksError) throw tasksError;
      setAssignedTasks((tasks as AssignedTask[]) || []);
    } catch (err: unknown) {
      console.error('Error fetching CEO dashboard data:', err);
      showToast('خطا در دریافت اطلاعات مدیریتی سامانه', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchCeoData();
  }, [fetchCeoData]);

  // Compute KPI metrics
  const todayIso = getTodayIsoDate();
  const currentMonthPrefix = todayIso.slice(0, 7); // e.g. "2026-10"

  const todayMinutes = workLogs
    .filter((l) => l.work_date === todayIso)
    .reduce((acc, curr) => acc + curr.duration_minutes, 0);

  const monthMinutes = workLogs
    .filter((l) => l.work_date.startsWith(currentMonthPrefix))
    .reduce((acc, curr) => acc + curr.duration_minutes, 0);

  const activeEmployeesCount = profiles.filter((p) => p.is_active).length;

  const averageProjectsProgress =
    projects.length > 0
      ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length)
      : 0;

  const openCriticalBlockersCount = workLogs.filter(
    (l) => l.has_blocker && !l.blocker_resolved && l.blocker_severity === 'critical'
  ).length;

  // Performance per employee calculation
  const employeeMetrics: EmployeePerformanceMetric[] = profiles.map((p) => {
    const userLogs = workLogs.filter((l) => l.user_id === p.id);
    const totalMins = userLogs.reduce((acc, curr) => acc + curr.duration_minutes, 0);
    const approved = userLogs.filter((l) => l.manager_status === 'approved').length;
    const blockers = userLogs.filter((l) => l.has_blocker).length;
    const completedTasks = assignedTasks.filter(
      (t) => t.assigned_to === p.id && t.status === 'done'
    ).length;

    return {
      profile: p,
      totalMinutes: totalMins,
      logsCount: userLogs.length,
      approvedCount: approved,
      blockersCount: blockers,
      completedTasksCount: completedTasks,
    };
  });

  // Maximum minutes for relative visual progress bar
  const maxMinutes = Math.max(1, ...employeeMetrics.map((m) => m.totalMinutes));

  // Role Promotion/Demotion
  const handleChangeRole = async (targetUserId: string, newRole: UserRole) => {
    if (targetUserId === user?.id) {
      if (!window.confirm('آیا مطمئن هستید که می‌خواهید سطح دسترسی حساب خود را تغییر دهید؟')) {
        return;
      }
    }

    setUpdatingRoleId(targetUserId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId);

      if (error) throw error;

      showToast(`نقش کاربری با موفقیت به ${newRole === 'ceo' ? 'مدیرعامل' : newRole === 'manager' ? 'مدیر فنی' : 'کارمند'} تغییر یافت.`, 'success');
      setProfiles((prev) =>
        prev.map((p) => (p.id === targetUserId ? { ...p, role: newRole } : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در تغییر سطح دسترسی';
      showToast(msg, 'error');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Toggle Active/Inactive Status
  const handleToggleActive = async (targetUserId: string, currentStatus: boolean) => {
    if (targetUserId === user?.id) {
      showToast('نمی‌توانید حساب کاربری فعال خود را غیرفعال کنید.', 'warning');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', targetUserId);

      if (error) throw error;

      showToast(`وضعیت کاربر به ${!currentStatus ? 'فعال' : 'غیرفعال'} تغییر یافت.`, 'info');
      setProfiles((prev) =>
        prev.map((p) => (p.id === targetUserId ? { ...p, is_active: !currentStatus } : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در تغییر وضعیت کاربر';
      showToast(msg, 'error');
    }
  };

  // Filter profiles for management
  const filteredProfiles = profiles.filter((p) =>
    p.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    p.department.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Top Announcements */}
      <AnnouncementBanner />

      {/* 1. Executive KPI Cards */}
      <div id="kpi-section" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Company Hours Logged */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">مجموع ساعت کارکرد امروز</span>
            <div className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {formatDuration(todayMinutes)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              کل ماه جاری: <span className="font-bold text-slate-700">{formatDuration(monthMinutes)}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Active Team Members */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">پرسنل فعال شرکت</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {toPersianDigits(activeEmployeesCount)} <span className="text-xs font-normal text-slate-500">نفر</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              کل اعضای ثبت‌شده در سامانه: <span className="font-bold text-slate-700">{toPersianDigits(profiles.length)}</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Average Projects Progress */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">میانگین پیشرفت پروژه‌ها</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {toPersianDigits(averageProjectsProgress)}٪
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              تعداد پروژه‌های فعال: <span className="font-bold text-slate-700">{toPersianDigits(projects.length)}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Open Critical Blockers */}
        <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">موانع بحرانی باز</span>
            <div
              className={`p-2 rounded-xl ${
                openCriticalBlockersCount > 0
                  ? 'bg-rose-50 text-rose-600 animate-pulse'
                  : 'bg-slate-50 text-slate-400'
              }`}
            >
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div
              className={`text-2xl font-black ${
                openCriticalBlockersCount > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {toPersianDigits(openCriticalBlockersCount)}{' '}
              <span className="text-xs font-normal text-slate-500">مورد</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              نیازمند اقدام فوری مدیر فنی
            </div>
          </div>
        </div>
      </div>

      {/* 2. Performance Analytics & Employee Comparison */}
      <div id="comparison-section" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-600" />
              <span>تحلیل مقایسه‌ای عملکرد پرسنل شرکت</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مقایسه شفاف ساعات کارکرد، تسک‌های انجام‌شده، گزارش‌های تاییدشده و موانع اعلامی
            </p>
          </div>
          <button
            onClick={fetchCeoData}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="به‌روزرسانی آمار"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold">
                <th className="pb-3 pr-2">نام پرسنل</th>
                <th className="pb-3">دپارتمان</th>
                <th className="pb-3">نقش سازمانی</th>
                <th className="pb-3 text-center">مجموع کارکرد</th>
                <th className="pb-3 text-center">گزارش‌های تاییدشده</th>
                <th className="pb-3 text-center">تسک‌های تکمیل‌شده</th>
                <th className="pb-3 text-center">موانع کاری</th>
                <th className="pb-3 pl-2 w-40">نمودار نسبی کارکرد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeMetrics.map((item) => {
                const percentOfMax = Math.round((item.totalMinutes / maxMinutes) * 100);

                return (
                  <tr key={item.profile.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 pr-2 font-bold text-slate-900">
                      {item.profile.full_name}
                    </td>
                    <td className="py-3.5 text-slate-600">{item.profile.department}</td>
                    <td className="py-3.5">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                          item.profile.role === 'ceo'
                            ? 'bg-brand-100 text-brand-800'
                            : item.profile.role === 'manager'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.profile.role === 'ceo'
                          ? 'مدیرعامل'
                          : item.profile.role === 'manager'
                          ? 'مدیر فنی'
                          : 'کارمند'}
                      </span>
                    </td>
                    <td className="py-3.5 text-center font-extrabold text-slate-800">
                      {formatDuration(item.totalMinutes)}
                    </td>
                    <td className="py-3.5 text-center font-bold text-emerald-700">
                      {toPersianDigits(item.approvedCount)} / {toPersianDigits(item.logsCount)}
                    </td>
                    <td className="py-3.5 text-center font-bold text-brand-700">
                      {toPersianDigits(item.completedTasksCount)}
                    </td>
                    <td className="py-3.5 text-center font-bold text-rose-700">
                      {toPersianDigits(item.blockersCount)}
                    </td>
                    <td className="py-3.5 pl-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-brand-600 h-full rounded-full"
                            style={{ width: `${percentOfMax}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono w-7 text-left">
                          {toPersianDigits(percentOfMax)}٪
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Team & Role Management (CEO Exclusive) */}
      <div id="users-mgmt" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              <span>مدیریت پرسنل و سطوح دسترسی (RBAC)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ارتقا یا تغییر سطح دسترسی پرسنل به کارمند، مدیر فنی یا مدیرعامل، و فعال/غیرفعال‌سازی حساب
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="جستجوی نام یا ایمیل..."
              className="pr-9 pl-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 w-56"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredProfiles.map((p) => (
            <div
              key={p.id}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-bold text-brand-800 text-sm shadow-xs">
                  {p.full_name.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                      {p.full_name}
                    </span>
                    {!p.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                        غیرفعال
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{p.email}</span>
                    <span>•</span>
                    <span>{p.department}</span>
                  </div>
                </div>
              </div>

              {/* Action Controls for CEO */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[11px]">نقش:</span>
                  <select
                    disabled={updatingRoleId === p.id}
                    value={p.role}
                    onChange={(e) => handleChangeRole(p.id, e.target.value as UserRole)}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="employee">کارمند فنی</option>
                    <option value="manager">مدیر فنی / سرپرست</option>
                    <option value="ceo">مدیرعامل (دسترسی کامل)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleActive(p.id, p.is_active)}
                  className={`p-2 rounded-xl border transition ${
                    p.is_active
                      ? 'border-slate-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  }`}
                  title={p.is_active ? 'غیرفعال‌سازی کاربر' : 'فعال‌سازی مجدد کاربر'}
                >
                  {p.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Projects Overview Section */}
      <div id="projects-overview" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-6">
          <FolderKanban className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-black text-slate-900">
            وضعیت و پیشرفت کل پروژه‌های شرکت
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/40 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">{proj.name}</h4>
                  <span className="text-xs font-black text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                    {toPersianDigits(proj.progress)}٪
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {proj.description || 'بدون توضیحات تکمیلی'}
                </p>
              </div>

              <div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-2">
                  <div
                    className="bg-brand-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>وضعیت: {proj.status === 'active' ? 'در حال اجرا' : proj.status}</span>
                  <span>تاریخ ایجاد: {formatPersianDate(proj.created_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Real Excel (CSV) Export & Official Print */}
      <div id="export-section" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>خروجی رسمی اکسل و نسخه چاپی کارکرد</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              دریافت فایل اکسل کامل کارکرد به همراه گزارش موانع و بازخوردها با انکودینگ استاندارد UTF-8 BOM
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportWorkLogsToCsv(workLogs, 'گزارش_جامع_مگابایت_سیستم')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>خروجی فایل اکسل (.CSV)</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ رسمی / خروجی PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
