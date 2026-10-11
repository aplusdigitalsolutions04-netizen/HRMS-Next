// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';

// Registers the service worker (production only, so development is never served stale files) and keeps the
// browser's "install" prompt so the Install button on the Preferences page can use it. Renders nothing itself.
export default function InstallApp() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const onPrompt = (e: any) => { e.preventDefault(); (window as any).__installEvt = e; window.dispatchEvent(new Event('pwa-install-change')); };
    const onInstalled = () => { (window as any).__installEvt = null; (window as any).__appInstalled = true; window.dispatchEvent(new Event('pwa-install-change')); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  return null;
}

// Used on the Preferences page: the install button, or a note when the app cannot be installed right now.
export function InstallCard({ card }: { card?: any }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick(n => n + 1);
    window.addEventListener('pwa-install-change', f);
    return () => window.removeEventListener('pwa-install-change', f);
  }, []);
  const w: any = typeof window !== 'undefined' ? window : {};
  const standalone = !!(w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || !!w.__appInstalled;
  const evt = w.__installEvt;
  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 4px', fontSize: '.95rem' }}>Install app</h3>
      <p style={{ margin: '0 0 10px', fontSize: '.82rem', color: '#64748b' }}>
        Add HRMS to your phone or computer like a normal app, with its own icon and window.
      </p>
      {standalone ? (
        <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#15803d' }}>The app is already installed on this device.</div>
      ) : evt ? (
        <button type="button" className="btn-p" onClick={async () => { evt.prompt(); try { await evt.userChoice; } catch {} (window as any).__installEvt = null; tick(n => n + 1); }}>Install app</button>
      ) : (
        <div style={{ fontSize: '.82rem', color: '#94a3b8' }}>Not available in this browser right now. Open the site in Chrome or Edge (or use "Add to Home Screen" on your phone) to install it.</div>
      )}
    </div>
  );
}
