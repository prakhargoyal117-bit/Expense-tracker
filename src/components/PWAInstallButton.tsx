import { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  showAlwaysInSettings?: boolean;
}

export function PWAInstallButton({
  showAlwaysInSettings = false,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    if (showAlwaysInSettings) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-800">
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Installed in Standalone App Mode</span>
        </span>
      );
    }
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS || showAlwaysInSettings) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isIOS ? 'Install on iOS' : 'How to Install App'}</span>
        </button>

        {showGuideModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pwa-install-guide-title"
              className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-lg p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  id="pwa-install-guide-title"
                  className="text-base font-semibold text-slate-900"
                >
                  Install CampusLedger on Your Phone
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  aria-label="Close install instructions"
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {isIOS ? (
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Open this page in <strong>Safari</strong> on your iPhone or iPad.
                  </li>
                  <li>
                    Tap the <strong>Share</strong> icon in the bottom toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong>Add to Home Screen</strong>.
                  </li>
                </ol>
              ) : (
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                  <li>
                    Open the shared web link directly in <strong>Chrome</strong> on Android (not inside an embedded preview frame).
                  </li>
                  <li>
                    Tap the <strong>⋮</strong> menu in the top right and select{' '}
                    <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                  <li>
                    CampusLedger will appear on your home screen with its own icon and launch full-screen without an APK.
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2 px-4 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
