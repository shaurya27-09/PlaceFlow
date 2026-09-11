import React, { useState } from 'react';
import { Download, Smartphone, Share2 } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { IOSInstallModal } from './IOSInstallModal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer' | 'compact' | 'badge';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
  onInstalled
}) => {
  const { isInstallable, isInstalled, isIOS, install, canInstall } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  // If already installed in standalone mode, suppress button completely
  if (isInstalled || !canInstall) {
    return null;
  }

  const handleClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (isInstallable) {
      setIsPrompting(true);
      const success = await install();
      setIsPrompting(false);
      if (success && onInstalled) {
        onInstalled();
      }
    }
  };

  // Drawer full-width variant
  if (variant === 'drawer') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isPrompting}
          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 transition-all min-h-[44px] ${className}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              {isIOS ? <Share2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
            </div>
            <div className="text-left">
              <span className="font-bold block">{isIOS ? 'Install on iPhone / iPad' : 'Install Mobile App'}</span>
              <span className="text-[10px] text-blue-600/80 dark:text-blue-400 font-normal">Add PlaceFlow to Home Screen</span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-600 text-white shadow-2xs">
            {isIOS ? 'Safari' : 'PWA'}
          </span>
        </button>

        <IOSInstallModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
      </>
    );
  }

  // Header compact button
  return (
    <>
      <button
        type="button"
        id="pwa-install-header-btn"
        onClick={handleClick}
        disabled={isPrompting}
        title={isIOS ? 'Add PlaceFlow to Home Screen' : 'Install PlaceFlow App'}
        aria-label={isIOS ? 'Add PlaceFlow to Home Screen' : 'Install PlaceFlow App'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
          isIOS
            ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60'
            : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-500/20'
        } ${className}`}
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline font-bold">
          {isIOS ? 'Add to Home' : 'Install App'}
        </span>
      </button>

      <IOSInstallModal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} />
    </>
  );
};
