import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  AlertOctagon,
  Send,
  Calendar,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Stopwatch } from '../components/Stopwatch';
import { AnnouncementBanner } from '../components/AnnouncementBanner';
import type { Project, WorkLog, AssignedTask, SubTask, TaskStatus, BlockerSeverity } from '../types/database';
import { formatPersianDate, formatDuration, getTodayIsoDate, toPersianDigits } from '../utils/date';

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  // State for projects and logs
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [myLogs, setMyLogs] = useState<WorkLog[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Form states
  const [projectId, setProjectId] = useState<string>('');
  const [workDate, setWorkDate] = useState<string>(getTodayIsoDate());
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(30);
  const [summary, setSummary] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(50);

  // Subtasks
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState<string>('');

  // Blocker states
  const [hasBlocker, setHasBlocker] = useState<boolean>(false);
  const [blockerCategory, setBlockerCategory] = useState<string>('فنی و کدنویسی');
  const [blockerSeverity, setBlockerSeverity] = useState<BlockerSeverity>('medium');
  const [blockerDescription, setBlockerDescription] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        const projs = data as Project[];
        setProjects(projs);
        if (projs.length > 0 && !projectId) {
          setProjectId(projs[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch projects error:', err);
    } finally {
      setLoadingProjects(false);
    }
  }, [projectId]);

  // Fetch assigned tasks
  const fetchAssignedTasks = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('assigned_tasks')
        .select(`
          *,
          projects:project_id (*),
          creator:assigned_by (full_name)
        `)
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAssignedTasks(data as unknown as AssignedTask[]);
      }
    } catch (err) {
      console.error('Fetch assigned tasks error:', err);
    } finally {
      setLoadingTasks(false);
    }
  }, [user?.id]);

  // Fetch my work logs
  const fetchMyLogs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('work_logs')
        .select(`
          *,
          projects:project_id (*),
          reviewer:reviewed_by (full_name)
        `)
        .eq('user_id', user.id)
        .order('work_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMyLogs(data as unknown as WorkLog[]);
      }
    } catch (err) {
      console.error('Fetch my logs error:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProjects();
    fetchAssignedTasks();
    fetchMyLogs();
  }, [fetchProjects, fetchAssignedTasks, fetchMyLogs]);

  // Stopwatch transfer
  const handleTransferStopwatchTime = (h: number, m: number) => {
    setHours(h);
    setMinutes(m);
    showToast(`مدت زمان ${formatDuration(h * 60 + m)} به فرم منتقل شد.`, 'info');
  };

  // Add subtask
  const handleAddSubTask = () => {
    if (!newSubTaskTitle.trim()) return;
    const newTask: SubTask = {
      id: Math.random().toString(36).substring(2, 9),
      title: newSubTaskTitle.trim(),
      completed: true,
    };
    setSubTasks((prev) => [...prev, newTask]);
    setNewSubTaskTitle('');
  };

  const toggleSubTask = (id: string) => {
    setSubTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const removeSubTask = (id: string) => {
    setSubTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Update assigned task status
  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('assigned_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      showToast('وضعیت تسک به‌روزرسانی شد.', 'success');
      setAssignedTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در تغییر وضعیت تسک';
      showToast(msg, 'error');
    }
  };

  // Delete work log (allowed if pending)
  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm('آیا از حذف این گزارش فعالیت اطمینان دارید؟')) return;

    try {
      const { error } = await supabase.from('work_logs').delete().eq('id', logId);
      if (error) throw error;
      showToast('گزارش فعالیت با موفقیت حذف گردید.', 'info');
      setMyLogs((prev) => prev.filter((l) => l.id !== logId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در حذف گزارش';
      showToast(msg, 'error');
    }
  };

  // Submit work log form
  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      showToast('لطفاً ابتدا وارد حساب کاربری خود شوید.', 'error');
      return;
    }

    if (!projectId) {
      showToast('لطفاً پروژه مربوطه را انتخاب کنید.', 'warning');
      return;
    }

    const totalMinutes = Number(hours) * 60 + Number(minutes);
    if (totalMinutes <= 0) {
      showToast('مدت زمان کارکرد باید حداقل ۱ دقیقه باشد.', 'warning');
      return;
    }

    if (!summary.trim()) {
      showToast('لطفاً شرح فعالیت انجام‌شده را بنویسید.', 'warning');
      return;
    }

    if (hasBlocker && !blockerDescription.trim()) {
      showToast('لطفاً شرح مانع یا مشکل ایجادشده را یادداشت فرمایید.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('work_logs').insert({
        user_id: user.id,
        project_id: projectId,
        work_date: workDate,
        duration_minutes: totalMinutes,
        summary: summary.trim(),
        sub_tasks: subTasks,
        progress_percent: progressPercent,
        has_blocker: hasBlocker,
        blocker_category: hasBlocker ? blockerCategory : null,
        blocker_severity: hasBlocker ? blockerSeverity : 'low',
        blocker_description: hasBlocker ? blockerDescription.trim() : null,
        blocker_resolved: false,
        manager_status: 'pending',
      });

      if (error) {
        throw error;
      }

      showToast('گزارش فعالیت با موفقیت ثبت شد و برای تایید مدیر ارسال گردید.', 'success');
      // Reset form
      setSummary('');
      setSubTasks([]);
      setHasBlocker(false);
      setBlockerDescription('');
      setProgressPercent(50);
      setHours(0);
      setMinutes(30);

      // Refresh log list
      await fetchMyLogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت گزارش کارکرد';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>تایید شده توسط مدیر</span>
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>نیاز به اصلاح</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>در انتظار بررسی</span>
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: BlockerSeverity) => {
    switch (priority) {
      case 'critical':
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">فوری / بحرانی</span>;
      case 'medium':
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">اولویت متوسط</span>;
      default:
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">عادی</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner for Announcements */}
      <AnnouncementBanner />

      {/* Grid: Stopwatch & Activity Log Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Stopwatch & Quick Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div id="stopwatch">
            <Stopwatch onTransferTime={handleTransferStopwatchTime} />
          </div>

          {/* Quick Stats Box */}
          <div className="bg-white rounded-2xl p-5 shadow-card border border-slate-200/80">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <span>خلاصه کارکرد ثبت‌شده شما</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-500 block">گزارش‌های ثبت‌شده</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {toPersianDigits(myLogs.length)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] text-slate-500 block">تسک‌های محول‌شده</span>
                <span className="text-xl font-black text-slate-900 mt-1 block">
                  {toPersianDigits(assignedTasks.length)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Comprehensive Activity Logging Form */}
        <div id="worklog-form" className="lg:col-span-2">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
            <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-brand-600" />
                  <span>فرم ثبت گزارش فعالیت روزانه</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  اطلاعات کارکرد خود را با دقت ثبت کنید تا به صورت مستقیم در پنل مدیر فنی و مدیرعامل پایش شود.
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                سیستم آنلاین
              </span>
            </div>

            <form onSubmit={handleSubmitLog} className="space-y-6">
              {/* Project & Date Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    پروژه مرتبط <span className="text-rose-500">*</span>
                  </label>
                  {loadingProjects ? (
                    <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
                  ) : (
                    <select
                      required
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      {projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name} ({proj.progress}٪ تکمیل شده)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    تاریخ فعالیت <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ltr text-right"
                    />
                  </div>
                </div>
              </div>

              {/* Hours & Minutes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  مدت زمان صرف‌شده <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 ltr text-center font-bold"
                    />
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      ساعت
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 ltr text-center font-bold"
                    />
                    <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                      دقیقه
                    </span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  شرح کامل فعالیت و اقدامات انجام‌شده <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="اقدامات کلیدی، ماژول‌های توسعه داده شده یا تست‌های انجام شده را شرح دهید..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Interactive Sub-tasks checklist */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  چک‌لیست زیرتسک‌های انجام‌شده (اختیاری اما توصیه شده)
                </label>
                <div className="flex gap-2 mb-2.5">
                  <input
                    type="text"
                    value={newSubTaskTitle}
                    onChange={(e) => setNewSubTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubTask();
                      }
                    }}
                    placeholder="عنوان زیرتسک (مثال: رفع باگ کوئری، طراحی کامپوننت فرم)"
                    className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubTask}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن</span>
                  </button>
                </div>

                {subTasks.length > 0 && (
                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    {subTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs shadow-xs"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubTask(task.id)}
                          className="flex items-center gap-2 text-right"
                        >
                          {task.completed ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                          <span
                            className={
                              task.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-700 font-medium'
                            }
                          >
                            {task.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSubTask(task.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    میزان برآورد پیشرفت این تسک
                  </label>
                  <span className="text-xs font-extrabold text-brand-700 px-2.5 py-0.5 rounded-full bg-brand-50 border border-brand-200">
                    {toPersianDigits(progressPercent)}٪
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(Number(e.target.value))}
                  className="w-full accent-brand-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
              </div>

              {/* Blocker & Problem Reporting Toggle */}
              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                      <AlertOctagon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                        در انجام این تسک با مانع، باگ یا ابهام مواجه شدم
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        با فعال‌سازی این گزینه، موضوع بلافاصله در «مرکز رسیدگی فوری مدیران» ثبت می‌شود.
                      </span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBlocker}
                      onChange={(e) => setHasBlocker(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>

                {hasBlocker && (
                  <div className="mt-4 p-5 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-rose-900 mb-1">
                          دسته‌بندی مانع
                        </label>
                        <select
                          value={blockerCategory}
                          onChange={(e) => setBlockerCategory(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-rose-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                        >
                          <option value="فنی و کدنویسی">فنی و کدنویسی</option>
                          <option value="سرور و زیرساخت">سرور و زیرساخت</option>
                          <option value="ابهام در تسک / طراحی">ابهام در تسک / طراحی</option>
                          <option value="هماهنگی تیمی / دسترسی">هماهنگی تیمی / دسترسی</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-rose-900 mb-1">
                          سطح بحرانی بودن (اولویت رسیدگی)
                        </label>
                        <select
                          value={blockerSeverity}
                          onChange={(e) => setBlockerSeverity(e.target.value as BlockerSeverity)}
                          className="w-full px-3 py-2 text-xs border border-rose-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                        >
                          <option value="low">کم (مانع فرعی است و کار متوقف نشده)</option>
                          <option value="medium">متوسط (سرعت پیشرفت را کند کرده است)</option>
                          <option value="critical">بحرانی (کار کاملاً قفل و متوقف شده است)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-rose-900 mb-1">
                        شرح دقیق گیر یا مشکل <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        required={hasBlocker}
                        rows={2}
                        value={blockerDescription}
                        onChange={(e) => setBlockerDescription(e.target.value)}
                        placeholder="مشکل دقیقاً چیست؟ چه پیام خطایی دریافت کردید؟ چه کمکی از مدیر فنی نیاز دارید؟"
                        className="w-full px-3 py-2 text-xs border border-rose-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm shadow-lg shadow-brand-600/30 transition active:scale-[0.98] disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'در حال ثبت در دیتابیس...' : 'ثبت نهایی گزارش فعالیت'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Section: My Assigned Tasks */}
      <div id="assigned-tasks" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-brand-600" />
            <h3 className="font-black text-slate-900 text-base">
              تسک‌های محول شده به من از طرف مدیران
            </h3>
          </div>
          <button
            onClick={fetchAssignedTasks}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="به‌روزرسانی لیست تسک‌ها"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadingTasks ? (
          <div className="py-8 text-center text-xs text-slate-400">در حال بارگذاری تسک‌ها...</div>
        ) : assignedTasks.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            در حال حاضر هیچ تسکی به شما محول نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignedTasks.map((task) => (
              <div
                key={task.id}
                className="p-5 rounded-2xl border border-slate-200 hover:border-brand-300 transition bg-slate-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-bold text-slate-900 text-sm">{task.title}</h4>
                    {getPriorityBadge(task.priority)}
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mb-4">
                    {task.projects?.name && (
                      <span className="font-semibold text-brand-700">
                        پروژه: {task.projects.name}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        مهلت: {formatPersianDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Switcher for this task */}
                <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-medium">وضعیت تسک:</span>
                  <select
                    value={task.status}
                    onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="todo">در صف انجام (Todo)</option>
                    <option value="in_progress">در حال انجام (In Progress)</option>
                    <option value="blocked">گیر کرده / مشکل دار (Blocked)</option>
                    <option value="done">تکمیل شده (Done)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: My Log History & Manager Solutions */}
      <div id="log-history" className="bg-white rounded-3xl p-6 sm:p-8 shadow-card border border-slate-200/80">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-600" />
            <h3 className="font-black text-slate-900 text-base">
              سوابق گزارش‌های ارسالی من و بازخورد مدیران
            </h3>
          </div>
          <button
            onClick={fetchMyLogs}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="به‌روزرسانی سوابق"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadingLogs ? (
          <div className="py-8 text-center text-xs text-slate-400">در حال دریافت سوابق...</div>
        ) : myLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            تاکنون هیچ گزارش فعالیتی توسط شما ثبت نشده است. از فرم بالا اولین گزارش خود را ثبت فرمایید.
          </div>
        ) : (
          <div className="space-y-4">
            {myLogs.map((log) => (
              <div
                key={log.id}
                className="p-5 rounded-2xl border border-slate-200/90 hover:border-slate-300 transition bg-white shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {log.projects?.name || 'پروژه سازمانی'}
                    </span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                      {formatDuration(log.duration_minutes)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(log.manager_status)}
                    {log.manager_status === 'pending' && (
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 transition"
                        title="حذف گزارش (فقط قبل از تایید مدیر)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
                  {log.summary}
                </p>

                {/* Subtasks if any */}
                {log.sub_tasks && log.sub_tasks.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {log.sub_tasks.map((st) => (
                      <span
                        key={st.id}
                        className={`text-[11px] px-2 py-0.5 rounded-md border ${
                          st.completed
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        ✓ {st.title}
                      </span>
                    ))}
                  </div>
                )}

                {/* Blocker alert box */}
                {log.has_blocker && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 mb-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-rose-900 mb-1">
                      <AlertOctagon className="w-4 h-4 text-rose-600" />
                      <span>
                        مانع اعلام شده ({log.blocker_category}) -{' '}
                        {log.blocker_severity === 'critical' ? 'بحرانی' : 'متوسط'}
                      </span>
                      {log.blocker_resolved && (
                        <span className="mr-auto text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          حل شده توسط مدیر ✓
                        </span>
                      )}
                    </div>
                    <p className="text-rose-800/90 leading-relaxed">{log.blocker_description}</p>
                  </div>
                )}

                {/* Manager Feedback / Solution Box */}
                {log.manager_feedback && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950">
                    <div className="flex items-center gap-1.5 font-bold mb-1 text-brand-900">
                      <FileText className="w-4 h-4 text-brand-600" />
                      <span>
                        پاسخ و راهکار مدیر فنی {log.reviewer?.full_name ? `(${log.reviewer.full_name})` : ''}:
                      </span>
                    </div>
                    <p className="leading-relaxed text-blue-900">{log.manager_feedback}</p>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>تاریخ فعالیت: {formatPersianDate(log.work_date)}</span>
                  <span>پیشرفت: {toPersianDigits(log.progress_percent)}٪</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
