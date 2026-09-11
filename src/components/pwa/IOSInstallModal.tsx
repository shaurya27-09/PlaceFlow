import React from 'react';
import { X, Share, PlusSquare, Smartphone, CheckCircle2 } from 'lucide-react';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 text-slate-900 dark:text-slate-100 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md overflow-hidden shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="PlaceFlow Icon"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <h3 id="ios-install-title" className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                Install PlaceFlow
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                iPhone & iPad Home Screen App
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-3 pt-1">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            To install PlaceFlow:
          </p>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200/60 dark:border-slate-700/60 space-y-2.5">
            <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <span className="font-bold text-[11px]">1</span>
              </div>
              <div className="flex-1">
                Tap the <strong className="text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1">Share <Share className="w-3.5 h-3.5 inline" /></strong> button in the Safari toolbar (at the bottom on iPhone or top on iPad).
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <span className="font-bold text-[11px]">2</span>
              </div>
              <div className="flex-1">
                Scroll down and tap <strong className="text-blue-600 dark:text-blue-400 font-semibold inline-flex items-center gap-1">Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline" /></strong>.
              </div>
            </div>

            <div className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1">
                Tap <strong>Add</strong> in the top right. PlaceFlow will launch full-screen from your Home Screen with fast, app-like performance.
              </div>
            </div>
          </div>
        </div>

        {/* Benefits Pill */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 text-[11px] text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40">
          <Smartphone className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>Standalone mode removes browser URL bars and keeps your session active.</span>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
