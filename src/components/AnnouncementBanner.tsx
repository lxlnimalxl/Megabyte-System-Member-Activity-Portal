import React, { useEffect, useState, useCallback } from 'react';
import { Megaphone, Plus, Trash2, X, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { Announcement } from '../types/database';
import { formatPersianDate } from '../utils/date';

export const AnnouncementBanner: React.FC = () => {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = profile?.role === 'ceo' || profile?.role === 'manager';

  const fetchAnnouncements = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          id,
          title,
          content,
          created_by,
          created_at,
          author:profiles!announcements_created_by_fkey (full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setAnnouncements(data as unknown as Announcement[]);
      }
    } catch (err) {
      console.error('Fetch announcements error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showToast('لطفاً عنوان و متن اطلاعیه را وارد نمایید.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: title.trim(),
        content: content.trim(),
        created_by: profile?.id || null,
      });

      if (error) {
        throw error;
      }

      showToast('اطلاعیه جدید با موفقیت منتشر شد.', 'success');
      setTitle('');
      setContent('');
      setShowModal(false);
      await fetchAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت اطلاعیه';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('آیا از حذف این اطلاعیه اطمینان دارید؟')) return;

    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      showToast('اطلاعیه حذف گردید.', 'info');
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در حذف اطلاعیه';
      showToast(msg, 'error');
    }
  };

  if (loading && announcements.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <Megaphone className="w-5 h-5 text-brand-600" />
            <span>اطلاعیه‌ها و پیام‌های سراسری مدیریت</span>
          </div>
          {canManage && (
            <button
              onClick={() => setShowModal(true)}
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ثبت اطلاعیه جدید</span>
            </button>
          )}
        </div>

        {announcements.length === 0 ? (
          <div className="p-4 rounded-xl border border-slate-200 bg-white text-slate-500 text-sm flex items-center gap-2">
            <span>اطلاعیه سراسری فعالی در سامانه ثبت نشده است.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className="relative p-4 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200/80 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-brand-950 text-sm">{announcement.title}</h4>
                    {canManage && (
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="text-slate-400 hover:text-rose-600 transition p-1"
                        title="حذف اطلاعیه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
                    {announcement.content}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-blue-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatPersianDate(announcement.created_at)}
                  </span>
                  {announcement.author?.full_name && (
                    <span className="text-brand-800 font-medium">
                      فرستنده: {announcement.author.full_name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for creating announcement */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">انتشار اطلاعیه سازمانی سراسری</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">عنوان اطلاعیه</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: جلسه هماهنگی پروژه‌های سه‌ماهه یا تغییر فرآیند تست"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">متن و جزئیات پیام</label>
                <textarea
                  required
                  rows={4}
                  placeholder="متن کامل اطلاعیه را بنویسید..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-semibold transition disabled:opacity-50"
                >
                  {submitting ? 'در حال انتشار...' : 'انتشار عمومی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
