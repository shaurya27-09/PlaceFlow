import { registerSW } from 'virtual:pwa-register';

export function setupPWARegistration() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          console.log('[PWA] New version of PlaceFlow available. Updating cache...');
          updateSW(true);
        },
        onOfflineReady() {
          console.log('[PWA] PlaceFlow app shell ready for standalone execution.');
        },
        onRegisteredSW(swUrl, registration) {
          console.log('[PWA] Service worker active at:', swUrl, 'scope:', registration?.scope);
        },
        onRegisterError(error) {
          console.warn('[PWA] Service worker registration notice:', error);
        }
      });
    } catch (e) {
      console.warn('[PWA] registerSW init:', e);
    }
  }
}
