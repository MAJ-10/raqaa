/**
 * Registers the service worker (sw.js) that keeps the website working offline after the first visit.
 * The dev server and the single file (raqaa.html) don't use it.
 */
export function registerOffline(): void {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'single') return;
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
      console.error('Offline setup failed', error);
    });
  });
}
