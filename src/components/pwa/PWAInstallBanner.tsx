import React, { useState } from 'react';
import { X, Download, Share2, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { IOSInstallModal } from './IOSInstallModal';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isDismissed, install, dismissBanner, canInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Suppress banner if:
  // 1. Already running in standalone (installed)
  // 2. Not installable on this device/browser
  // 3. User previously dismissed the banner in this session
  if (isInstalled || !canInstall || isDismissed) {
    return null;
  }

  const handleAction = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (isInstallable) {
      setIsInstalling(true);
      await install();
      setIsInstalling(false);
    }
  };

  return (
    <>
      <aside
        id="pwa-install-banner"
        aria-label="Install PlaceFlow App"
        className="fixed bottom-16 lg:bottom-5 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-md z-50 animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
      >
        <div className="bg-slate-900/95 dark:bg-slate-900/95 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center justify-between gap-3">
          {/* App Icon */}
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md overflow-hidden">
            <img
              src="/pwa-192x192.png"
              alt="PlaceFlow"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>

          {/* Text Info */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm text-white truncate">
                Install PlaceFlow
              </span>
              <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-300 text-[10px] font-bold rounded">
                App
              </span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-1 mt-0.5">
              {isIOS ? 'Add to iPhone Home Screen for standalone mode' : 'Fast, full-screen Training & Placement workflow'}
            </p>
          </div>

          {/* Action and Dismiss */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleAction}
              disabled={isInstalling}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer min-h-[36px]"
            >
              {isIOS ? (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>How to Add</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Install</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss install prompt"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <IOSInstallModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </>
  );
};
