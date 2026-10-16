import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, ArrowDownLeft } from 'lucide-react';
import { toPersianDigits } from '../utils/date';

interface StopwatchProps {
  onTransferTime: (hours: number, minutes: number) => void;
}

const STORAGE_KEY_START = 'megabyte_stopwatch_start';
const STORAGE_KEY_ELAPSED = 'megabyte_stopwatch_elapsed';
const STORAGE_KEY_RUNNING = 'megabyte_stopwatch_running';

export const Stopwatch: React.FC<StopwatchProps> = ({ onTransferTime }) => {
  const [isRunning, setIsRunning] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY_RUNNING) === 'true';
  });

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() => {
    const savedElapsed = parseInt(localStorage.getItem(STORAGE_KEY_ELAPSED) || '0', 10);
    const savedStart = parseInt(localStorage.getItem(STORAGE_KEY_START) || '0', 10);
    const wasRunning = localStorage.getItem(STORAGE_KEY_RUNNING) === 'true';

    if (wasRunning && savedStart > 0) {
      const now = Math.floor(Date.now() / 1000);
      const diff = Math.max(0, now - savedStart);
      return savedElapsed + diff;
    }
    return savedElapsed;
  });

  useEffect(() => {
    let interval: number | undefined;

    if (isRunning) {
      interval = window.setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          localStorage.setItem(STORAGE_KEY_ELAPSED, next.toString());
          return next;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const handleStart = () => {
    const now = Math.floor(Date.now() / 1000);
    localStorage.setItem(STORAGE_KEY_START, now.toString());
    localStorage.setItem(STORAGE_KEY_RUNNING, 'true');
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    localStorage.setItem(STORAGE_KEY_RUNNING, 'false');
    localStorage.setItem(STORAGE_KEY_ELAPSED, elapsedSeconds.toString());
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    localStorage.removeItem(STORAGE_KEY_START);
    localStorage.removeItem(STORAGE_KEY_ELAPSED);
    localStorage.removeItem(STORAGE_KEY_RUNNING);
  };

  const handleTransfer = () => {
    const totalMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    onTransferTime(hours, minutes);
  };

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="bg-gradient-to-br from-brand-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-brand-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-brand-300 font-semibold text-sm">
          <Clock className="w-5 h-5 text-brand-400 animate-pulse" />
          <span>تایمر هوشمند کارکرد پرسنل</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-brand-800/80 text-brand-200 border border-brand-700">
          ذخیره‌سازی پایدار
        </span>
      </div>

      <div className="text-center my-6">
        <div className="font-mono text-4xl sm:text-5xl font-bold tracking-wider text-white ltr drop-shadow">
          {toPersianDigits(pad(hours))}:{toPersianDigits(pad(minutes))}:{toPersianDigits(pad(seconds))}
        </div>
        <p className="text-xs text-brand-300/80 mt-2">
          {isRunning ? '⏱️ تایمر در حال ثبت زمان است...' : 'تایمر متوقف است'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              type="button"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-md active:scale-95"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>شروع کار</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              type="button"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-500 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-md active:scale-95"
            >
              <Pause className="w-4 h-4 fill-white" />
              <span>توقف موقت</span>
            </button>
          )}

          <button
            onClick={handleReset}
            type="button"
            title="تنظیم مجدد به صفر"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95 border border-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleTransfer}
          type="button"
          disabled={elapsedSeconds === 0}
          className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-md active:scale-95"
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>انتقال زمان به فرم گزارش</span>
        </button>
      </div>
    </div>
  );
};
