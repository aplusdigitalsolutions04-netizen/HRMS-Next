'use client';
import { useState, useEffect } from 'react';

// Light / dark switch for the signed-in pages. The choice is kept on this computer; with no choice yet, the computer's own setting is followed.
// The login pages stay light, so the mode is taken off again when the person signs out.
const read = (): 'light' | 'dark' => {
  try { const v = localStorage.getItem('theme'); if (v === 'dark' || v === 'light') return v; } catch { /* ignore */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function ThemeToggle({ className = 'header-icon-btn' }: { className?: string }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  useEffect(() => { setMode(read()); return () => { document.documentElement.removeAttribute('data-theme'); }; }, []);
  useEffect(() => { document.documentElement.setAttribute('data-theme', mode); }, [mode]);
  const flip = () => { const n = mode === 'dark' ? 'light' : 'dark'; setMode(n); try { localStorage.setItem('theme', n); } catch { /* ignore */ } };
  return (
    <button type="button" className={className} onClick={flip} title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Switch light or dark mode">
      {mode === 'dark' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      )}
    </button>
  );
}
