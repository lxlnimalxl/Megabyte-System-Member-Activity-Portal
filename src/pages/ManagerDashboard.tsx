import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  Clock,
  Filter,
  PlusCircle,
  FolderPlus,
  Layers,
  MessageSquare,
  Check,
  X,
  Calendar,
  User,
  RefreshCw,
  Send,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import type { WorkLog, Project, Profile, AssignedTask, BlockerSeverity, ReviewStatus } from '../types/database';
import { formatPersianDate, formatDuration, toPersianDigits, getTodayIsoDate } from '../utils/date';

export const ManagerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  // Data states
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for review queue
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Modal / Feedback state for review queue
  const [reviewModalLog, setReviewModalLog] = useState<WorkLog | null>(null);
  const [reviewAction, setReviewAction] = useState<ReviewStatus>('approved');
  const [managerFeedback, setManagerFeedback] = useState<string>('');
  const [savingReview, setSavingReview] = useState(false);

  // Blocker resolution state
  const [resolvingBlockerLog, setResolvingBlockerLog] = useState<WorkLog | null>(null);
  const [blockerSolution, setBlockerSolution] = useState<string>('');
  const [savingBlocker, setSavingBlocker] = useState(false);

  // New task assignment state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignedTo, setTaskAssignedTo] = useState('');
  const [taskProjectId, setTaskProjectId] = useState('');
  const [taskPriority, setTaskPriority] = useState<BlockerSeverity>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [assigningTask, setAssigningTask] = useState(false);

  // New project state
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Project progress update state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [updatedProgress, setUpdatedProgress] = useState<number>(0);
  const [updatingProgress, setUpdatingProgress] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Fetch work logs with joined profiles and projects
      const { data: logsData, error: logsError } = await supabase
        .from('work_logs')
        .select(`
          *,
          profiles:user_id (id, full_name, department, email),
          projects:project_id (id, name, progress),
          reviewer:reviewed_by (full_name)
        `)
        .order('created_at', { ascending: false });

      if (logsError) throw logsError;
      setWorkLogs((logsData as unknown as WorkLog[]) || []);

      // 2. Fetch projects
      const { data: projsData, error: projsError } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

      if (projsError) throw projsError;
      setProjects((projsData as Project[]) || []);
      if (projsData && projsData.length > 0 && !taskProjectId) {
        setTaskProjectId(projsData[0].id);
      }

      // 3. Fetch active team members
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (profilesError) throw profilesError;
      setEmployees((profilesData as Profile[]) || []);
      if (profilesData && profilesData.length > 0 && !taskAssignedTo) {
        setTaskAssignedTo(profilesData[0].id);
      }
    } catch (err: unknown) {
      console.error('Error fetching manager dashboard data:', err);
      showToast('خطا در دریافت اطلاعات سامانه', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, taskProjectId, taskAssignedTo]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Open blockers sorted critical first
  const openBlockers = workLogs
    .filter((log) => log.has_blocker && !log.blocker_resolved)
    .sort((a, b) => {
      const weight: Record<string, number> = { critical: 3, medium: 2, low: 1 };
      return (weight[b.blocker_severity] || 0) - (weight[a.blocker_severity] || 0);
    });

  // Filtered logs for review queue
  const filteredLogs = workLogs.filter((log) => {
    if (filterEmployee !== 'all' && log.user_id !== filterEmployee) return false;
    if (filterProject !== 'all' && log.project_id !== filterProject) return false;
    if (filterStatus !== 'all' && log.manager_status !== filterStatus) return false;
    return true;
  });

  // Handle Blocker Solution & Approval in one click
  const handleResolveBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingBlockerLog || !user?.id) return;
    if (!blockerSolution.trim()) {
      showToast('لطفاً راهکار یا دستورالعمل فنی رفع مشکل را یادداشت کنید.', 'warning');
      return;
    }

    setSavingBlocker(true);
    try {
      const { error } = await supabase
        .from('work_logs')
        .update({
          blocker_resolved: true,
          manager_status: 'approved',
          manager_feedback: blockerSolution.trim(),
          reviewed_by: user.id,
        })
        .eq('id', resolvingBlockerLog.id);

      if (error) throw error;

      showToast('مانع برطرف شد و راهکار برای کارمند ثبت گردید.', 'success');
      setResolvingBlockerLog(null);
      setBlockerSolution('');
      await fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت راهکار مانع';
      showToast(msg, 'error');
    } finally {
      setSavingBlocker(false);
    }
  };

  // Quick Approve Log
  const handleQuickApprove = async (logId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('work_logs')
        .update({
          manager_status: 'approved',
          reviewed_by: user.id,
        })
        .eq('id', logId);

      if (error) throw error;
      showToast('گزارش فعالیت با موفقیت تایید شد.', 'success');
      setWorkLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, manager_status: 'approved', reviewed_by: user.id } : l))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در تایید گزارش';
      showToast(msg, 'error');
    }
  };

  // Submit Detailed Review (Approve or Needs Revision with Feedback)
  const handleSubmitDetailedReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalLog || !user?.id) return;

    setSavingReview(true);
    try {
      const { error } = await supabase
        .from('work_logs')
        .update({
          manager_status: reviewAction,
          manager_feedback: managerFeedback.trim() || null,
          reviewed_by: user.id,
        })
        .eq('id', reviewModalLog.id);

      if (error) throw error;

      showToast(
        reviewAction === 'approved' ? 'گزارش تایید شد.' : 'گزارش جهت بازبینی و اصلاح به کارمند عودت داده شد.',
        'success'
      );
      setReviewModalLog(null);
      setManagerFeedback('');
      await fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت بازخورد';
      showToast(msg, 'error');
    } finally {
      setSavingReview(false);
    }
  };

  // Create Assigned Task
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!taskTitle.trim() || !taskAssignedTo) {
      showToast('لطفاً عنوان تسک و کارمند مسئول را مشخص نمایید.', 'warning');
      return;
    }

    setAssigningTask(true);
    try {
      const { error } = await supabase.from('assigned_tasks').insert({
        title: taskTitle.trim(),
        description: taskDesc.trim() || null,
        project_id: taskProjectId || null,
        assigned_to: taskAssignedTo,
        assigned_by: user.id,
        priority: taskPriority,
        due_date: taskDueDate || null,
        status: 'todo',
      });

      if (error) throw error;

      showToast('تسک جدید با موفقیت به پرسنل تخصیص داده شد.', 'success');
      setTaskTitle('');
      setTaskDesc('');
      setTaskDueDate('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در تخصیص تسک';
      showToast(msg, 'error');
    } finally {
      setAssigningTask(false);
    }
  };

  // Create New Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user?.id) {
      showToast('لطفاً نام پروژه را وارد نمایید.', 'warning');
      return;
    }

    setCreatingProject(true);
    try {
      const { error } = await supabase.from('projects').insert({
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || null,
        status: 'active',
        progress: 0,
        created_by: user.id,
      });

      if (error) throw error;

      showToast('پروژه جدید با موفقیت در سیستم ثبت گردید.', 'success');
      setNewProjectName('');
      setNewProjectDesc('');
      await fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ساخت پروژه';
      showToast(msg, 'error');
    } finally {
      setCreatingProject(false);
    }
  };

  // Update Project Progress
  const handleUpdateProjectProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    setUpdatingProgress(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ progress: updatedProgress })
        .eq('id', editingProject.id);

      if (error) throw error;

      showToast('درصد پیشرفت کلی پروژه به‌روزرسانی شد.', 'success');
      setEditingProject(null);
      await fetchAllData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در به‌روزرسانی پیشرفت پروژه';
      showToast(msg, 'error');
    } finally {
      setUpdatingProgress(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Announcements */}
      <AnnouncementBanner />

      {/* 1. Blocker Resolution Center (High Priority) */}
      <div id="blocker-center" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-rose-200">
        <div className="flex items-center justify-between pb-4 border-b border-rose-100 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 animate-pulse">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>مرکز رسیدگی فوری به موانع کاری پرسنل</span>
                {openBlockers.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black">
                    {toPersianDigits(openBlockers.length)} مورد باز
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                مشکلاتی که توسط کارمندان به عنوان مانع کارکرد اعلام شده و نیازمند راهکار و تایید فنی شماست.
              </p>
            </div>
          </div>
          <button
            onClick={fetchAllData}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="به‌روزرسانی موانع"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {openBlockers.length === 0 ? (
          <div className="p-8 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-center text-emerald-900">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <h4 className="font-bold text-sm">هیچ مانع یا مشکلی در حال حاضر گزارش نشده است!</h4>
            <p className="text-xs text-emerald-700 mt-1">
              تمامی پروژه‌ها و تسک‌های اعلامی پرسنل بدون قفل‌شدگی در حال پیشرفت هستند.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {openBlockers.map((log) => (
              <div
                key={log.id}
                className={`p-5 rounded-2xl border transition ${
                  log.blocker_severity === 'critical'
                    ? 'bg-rose-50/70 border-rose-300'
                    : 'bg-amber-50/50 border-amber-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {log.profiles?.full_name || 'کارمند'}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({log.profiles?.department || 'فنی'})
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200">
                      {log.projects?.name}
                    </span>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      log.blocker_severity === 'critical'
                        ? 'bg-rose-600 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {log.blocker_severity === 'critical' ? '🔴 بحرانی (کار متوقف)' : '🟡 متوسط'}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-rose-200 mb-3 text-xs leading-relaxed text-slate-800">
                  <div className="font-bold text-rose-900 mb-1 flex items-center gap-1">
                    <span>دسته‌بندی: {log.blocker_category}</span>
                  </div>
                  <p>{log.blocker_description}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-rose-200/60">
                  <span className="text-[11px] text-slate-500">
                    تاریخ گزارش: {formatPersianDate(log.work_date)} | مدت کارکرد: {formatDuration(log.duration_minutes)}
                  </span>
                  <button
                    onClick={() => {
                      setResolvingBlockerLog(log);
                      setBlockerSolution('');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition shadow-sm active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>ارائه راهکار فنی و رفع مانع</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Team Activity Review Queue */}
      <div id="review-queue" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-brand-600" />
              <span>صف بررسی و تایید گزارش‌های پرسنل</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              مشاهده جزئیات فعالیت‌های انجام‌شده، تایید یا عودت جهت بازبینی
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Employee */}
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
            >
              <option value="all">همه کارمندان</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>

            {/* Filter by Project */}
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
            >
              <option value="all">همه پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Filter by Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="pending">در انتظار بررسی</option>
              <option value="approved">تایید شده</option>
              <option value="needs_revision">نیاز به اصلاح</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">در حال دریافت لیست گزارش‌ها...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            هیچ گزارشی متناسب با فیلترهای انتخاب‌شده یافت نشد.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition bg-white shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {log.profiles?.full_name || 'کارمند'}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({log.profiles?.department || 'فنی'})
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-brand-50 text-brand-800 border border-brand-200 font-semibold">
                      {log.projects?.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        log.manager_status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.manager_status === 'needs_revision'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {log.manager_status === 'approved'
                        ? 'تایید شده ✓'
                        : log.manager_status === 'needs_revision'
                        ? 'نیاز به اصلاح'
                        : 'در انتظار تایید'}
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
                  {log.summary}
                </p>

                {/* Subtasks if present */}
                {log.sub_tasks && log.sub_tasks.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {log.sub_tasks.map((st) => (
                      <span
                        key={st.id}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200"
                      >
                        {st.completed ? '✓' : '○'} {st.title}
                      </span>
                    ))}
                  </div>
                )}

                {/* Blocker alert if present */}
                {log.has_blocker && (
                  <div className="mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                    <div className="font-bold flex items-center gap-1.5 mb-1">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                      <span>
                        مانع اعلام شده: {log.blocker_category} (
                        {log.blocker_severity === 'critical' ? 'بحرانی' : 'متوسط'})
                      </span>
                      {log.blocker_resolved && (
                        <span className="mr-auto text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          حل شده توسط مدیر
                        </span>
                      )}
                    </div>
                    <p>{log.blocker_description}</p>
                  </div>
                )}

                {/* Manager Feedback if already reviewed */}
                {log.manager_feedback && (
                  <div className="mb-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
                    <span className="font-bold block mb-0.5">بازخورد قبلی مدیر:</span>
                    <p>{log.manager_feedback}</p>
                  </div>
                )}

                {/* Actions row */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span>تاریخ: {formatPersianDate(log.work_date)}</span>
                    <span>کارکرد: {formatDuration(log.duration_minutes)}</span>
                    <span>پیشرفت: {toPersianDigits(log.progress_percent)}٪</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {log.manager_status !== 'approved' && (
                      <button
                        onClick={() => handleQuickApprove(log.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>تایید سریع</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setReviewModalLog(log);
                        setReviewAction('approved');
                        setManagerFeedback(log.manager_feedback || '');
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 transition"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                      <span>ثبت بازخورد / عودت</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Task Assignment & Project Control (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Assign Task Card */}
        <div id="assign-task" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
            <PlusCircle className="w-5 h-5 text-brand-600" />
            <h3 className="font-black text-slate-900 text-base">
              تعریف و تخصیص تسک جدید به پرسنل
            </h3>
          </div>

          <form onSubmit={handleAssignTask} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                عنوان تسک <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="مثال: پیاده‌سازی کوئری‌های بهینه‌سازی دیتابیس"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  کارمند مسئول <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={taskAssignedTo}
                  onChange={(e) => setTaskAssignedTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  پروژه مربوطه
                </label>
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اولویت تسک
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as BlockerSeverity)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold"
                >
                  <option value="low">کم (عادی)</option>
                  <option value="medium">متوسط</option>
                  <option value="critical">بحرانی / فوری</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مهلت انجام (Deadline)
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 ltr text-right"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                توضیحات و نیازمندی‌های تسک
              </label>
              <textarea
                rows={3}
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="توضیحات فنی، لینک رفرنس یا نکات کلیدی را بنویسید..."
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={assigningTask}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{assigningTask ? 'در حال ثبت...' : 'تخصیص تسک به کارمند'}</span>
            </button>
          </form>
        </div>

        {/* Project Management & Progress Card */}
        <div id="projects-mgmt" className="space-y-6">
          {/* Create New Project */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
              <FolderPlus className="w-5 h-5 text-brand-600" />
              <h3 className="font-black text-slate-900 text-base">تعریف پروژه جدید</h3>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام پروژه</label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="مثال: پیاده‌سازی زیرساخت هوش مصنوعی"
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">شرح و اهداف پروژه</label>
                <textarea
                  rows={2}
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="اهداف کلی و دستاوردهای مورد انتظار این پروژه..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={creatingProject}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                <span>{creatingProject ? 'در حال ایجاد...' : 'ایجاد پروژه سازمانی'}</span>
              </button>
            </form>
          </div>

          {/* Active Projects List with Progress Controller */}
          <div className="bg-white rounded-3xl p-6 shadow-card border border-slate-200/80">
            <h4 className="font-bold text-slate-900 text-xs mb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-600" />
              <span>کنترل و به‌روزرسانی درصد پیشرفت پروژه‌ها</span>
            </h4>

            <div className="space-y-3">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{proj.name}</span>
                    <span className="text-xs font-extrabold text-brand-700">
                      {toPersianDigits(proj.progress)}٪
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-brand-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => {
                        setEditingProject(proj);
                        setUpdatedProgress(proj.progress);
                      }}
                      className="text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                    >
                      تغییر درصد پیشرفت
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Blocker Solution */}
      {resolvingBlockerLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-600" />
                <span>دستورالعمل و حل مانع کارمند</span>
              </h3>
              <button
                onClick={() => setResolvingBlockerLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mb-4">
              <div className="font-bold text-slate-800">
                گزارش‌دهنده: {resolvingBlockerLog.profiles?.full_name} ({resolvingBlockerLog.projects?.name})
              </div>
              <div className="text-slate-600">
                <span className="font-semibold text-rose-800">شرح مانع:</span> {resolvingBlockerLog.blocker_description}
              </div>
            </div>

            <form onSubmit={handleResolveBlocker} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  دستورالعمل / راهکار فنی رفع مشکل <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={blockerSolution}
                  onChange={(e) => setBlockerSolution(e.target.value)}
                  placeholder="دستور، فایل، دسترسی یا راهکار حل این گیر را بنویسید تا به کارمند نمایش داده شود..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingBlockerLog(null)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingBlocker}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  {savingBlocker ? 'در حال ثبت...' : 'حل مانع و تایید گزارش'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detailed Review & Feedback */}
      {reviewModalLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                بررسی گزارش فعالیت پرسنل
              </h3>
              <button
                onClick={() => setReviewModalLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1 mb-4">
              <div className="font-bold text-slate-800">
                پرسنل: {reviewModalLog.profiles?.full_name} | پروژه: {reviewModalLog.projects?.name}
              </div>
              <div className="text-slate-600">
                شرح: {reviewModalLog.summary}
              </div>
            </div>

            <form onSubmit={handleSubmitDetailedReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تصمیم مدیر
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approved')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      reviewAction === 'approved'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    تایید گزارش فعالیت
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('needs_revision')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      reviewAction === 'needs_revision'
                        ? 'bg-rose-50 border-rose-500 text-rose-800 shadow-sm'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    نیاز به اصلاح و بازنویسی
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  توضیحات و بازخورد مدیر (نمایش به کارمند)
                </label>
                <textarea
                  rows={3}
                  value={managerFeedback}
                  onChange={(e) => setManagerFeedback(e.target.value)}
                  placeholder="نکات تکمیلی، تشویق یا مواردی که باید توسط کارمند اصلاح گردد..."
                  className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReviewModalLog(null)}
                  className="px-4 py-2 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={savingReview}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-brand-600 hover:bg-brand-500 text-white transition disabled:opacity-50"
                >
                  {savingReview ? 'در حال ثبت...' : 'ثبت تصمیم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Project Progress Edit */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm mb-3">
              به‌روزرسانی درصد پیشرفت پروژه: {editingProject.name}
            </h3>

            <form onSubmit={handleUpdateProjectProgress} className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span>درصد تکمیل پروژه</span>
                  <span className="text-brand-700">{toPersianDigits(updatedProgress)}٪</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={updatedProgress}
                  onChange={(e) => setUpdatedProgress(Number(e.target.value))}
                  className="w-full accent-brand-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-3.5 py-1.5 text-xs rounded-xl border border-slate-300 text-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={updatingProgress}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-brand-600 text-white"
                >
                  {updatingProgress ? 'در حال ذخیره...' : 'ذخیره درصد جدید'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
