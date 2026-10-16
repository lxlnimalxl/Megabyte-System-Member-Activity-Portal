import type { WorkLog } from '../types/database';
import { formatPersianDate, formatDuration } from './date';

function escapeCsvCell(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '""';
  const stringified = String(text).replace(/"/g, '""');
  return `"${stringified}"`;
}

export function exportWorkLogsToCsv(logs: WorkLog[], filename = 'گزارش_عملکرد_مگابایت_سیستم'): void {
  const headers = [
    'نام پرسنل',
    'دپارتمان',
    'نام پروژه',
    'تاریخ فعالیت',
    'مدت زمان',
    'دقایق کارکرد',
    'شرح فعالیت',
    'درصد پیشرفت',
    'دارای مانع یا مشکل',
    'دسته‌بندی مانع',
    'شدت مانع',
    'شرح مانع',
    'رفع شده؟',
    'وضعیت بررسی مدیر',
    'پاسخ/راهکار مدیر',
    'تاریخ ثبت سیستم'
  ];

  const statusMap: Record<string, string> = {
    pending: 'در انتظار بررسی',
    approved: 'تایید شده',
    needs_revision: 'نیاز به اصلاح'
  };

  const severityMap: Record<string, string> = {
    low: 'کم',
    medium: 'متوسط',
    critical: 'بحرانی'
  };

  const rows = logs.map((log) => [
    escapeCsvCell(log.profiles?.full_name || 'نامشخص'),
    escapeCsvCell(log.profiles?.department || '-'),
    escapeCsvCell(log.projects?.name || 'پروژه عمومی'),
    escapeCsvCell(formatPersianDate(log.work_date)),
    escapeCsvCell(formatDuration(log.duration_minutes)),
    escapeCsvCell(log.duration_minutes),
    escapeCsvCell(log.summary),
    escapeCsvCell(`${log.progress_percent}%`),
    escapeCsvCell(log.has_blocker ? 'بله' : 'خیر'),
    escapeCsvCell(log.blocker_category || '-'),
    escapeCsvCell(log.has_blocker ? severityMap[log.blocker_severity] || log.blocker_severity : '-'),
    escapeCsvCell(log.blocker_description || '-'),
    escapeCsvCell(log.blocker_resolved ? 'بله' : (log.has_blocker ? 'خیر' : '-')),
    escapeCsvCell(statusMap[log.manager_status] || log.manager_status),
    escapeCsvCell(log.manager_feedback || '-'),
    escapeCsvCell(formatPersianDate(log.created_at))
  ]);

  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.join(','))
  ].join('\r\n');

  // Add UTF-8 BOM (\uFEFF) to guarantee Microsoft Excel displays Persian characters cleanly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
