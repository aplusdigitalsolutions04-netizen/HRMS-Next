// @ts-nocheck
'use client';

// Shared motion system for the whole app. Every animation goes through the variants and
// components in this file so timing, easing and reduced-motion behaviour stay consistent.
// Rules: only opacity / transform are animated, 150-300ms, and `prefers-reduced-motion` turns
// movement off (MotionConfig reducedMotion="user").

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, MotionConfig, useReducedMotion, useAnimationControls } from 'motion/react';

export const EASE = [0.22, 1, 0.36, 1];
export const DUR = { fast: 0.15, base: 0.22, slow: 0.3 };

/* ── variants ── */
export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE } },
};
export const fade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base } },
};
export const stagger = (gap = 0.05, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});
export const popIn = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
  exit: { opacity: 0, scale: 0.97, y: 4, transition: { duration: DUR.fast } },
};
export const dropdown = {
  hidden: { opacity: 0, y: -6, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.1 } },
};
export const drawerRight = {
  hidden: { x: '100%' },
  show: { x: 0, transition: { duration: DUR.slow, ease: EASE } },
  exit: { x: '100%', transition: { duration: DUR.base, ease: EASE } },
};

/* ── provider: honours the OS "reduce motion" setting for every motion component ── */
export function MotionProvider({ children }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/* ── route change: subtle fade + small vertical move ──
   Plays on every pathname change WITHOUT remounting the page, so state inside pages that stay
   mounted between sub-routes (e.g. the settings workspace) is never reset. ── */
export function PageTransition({ pageKey, children, className }) {
  const controls = useAnimationControls();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; controls.start({ opacity: [0, 1], y: [8, 0], transition: { duration: DUR.base, ease: EASE } }); return; }
    controls.start({ opacity: [0, 1], y: [8, 0], transition: { duration: DUR.base, ease: EASE } });
  }, [pageKey]);
  return <motion.div className={className} animate={controls}>{children}</motion.div>;
}

/* ── group of children that enter one after another ──
   <Stagger className="bento"> <Item/> <Item/> </Stagger>  (each child is wrapped by <Item>) ── */
export function Stagger({ children, gap = 0.05, delay = 0, className, style, as = 'div' }) {
  const M = motion[as] || motion.div;
  return <M className={className} style={style} variants={stagger(gap, delay)} initial="hidden" animate="show">{children}</M>;
}
export function Item({ children, className, style, as = 'div', ...rest }) {
  const M = motion[as] || motion.div;
  return <M className={className} style={style} variants={fadeUp} {...rest}>{children}</M>;
}

/* ── lock page scroll + Esc to close + focus return, shared by Dialog and Drawer ── */
function useOverlay(open, onClose) {
  const last = useRef(null);
  // The latest onClose lives in a ref. Callers pass a new inline function on every render, and putting it in
  // the effect's dependencies re-ran the cleanup on every keystroke - which handed focus back to the button
  // that opened the dialog, so typing in a field jumped out after one letter.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    last.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape' && closeRef.current) closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      if (last.current && last.current.focus) last.current.focus();
    };
  }, [open]);
}

const backdropStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,.42)', zIndex: 10000 };

/* ── dialog: fade + scale in, animated exit, backdrop click / Esc closes ── */
export function Dialog({ open, onClose, children, width = 520, label = 'Dialog', closeOnBackdrop = true }) {
  useOverlay(open, onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="dlg" style={{ ...backdropStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          variants={fade} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: DUR.fast } }}
          onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose && onClose(); }}
        >
          <motion.div
            role="dialog" aria-modal="true" aria-label={label}
            variants={popIn} initial="hidden" animate="show" exit="exit"
            style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 24px 60px rgba(15,23,42,.22)' }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── drawer: slides in from the right over a soft backdrop ── */
export function Drawer({ open, onClose, children, width = 440, label = 'Panel' }) {
  useOverlay(open, onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="drw" style={backdropStyle}
          variants={fade} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: DUR.fast } }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
        >
          <motion.aside
            role="dialog" aria-modal="true" aria-label={label}
            variants={drawerRight} initial="hidden" animate="show" exit="exit"
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: width, background: '#fff', boxShadow: '-12px 0 40px rgba(15,23,42,.16)', overflow: 'auto' }}
          >
            {children}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── dropdown / popover menu with quick fade + slight move ── */
export function Menu({ open, children, className, style }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className={className} style={style} variants={dropdown} initial="hidden" animate="show" exit="exit">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── tabs: an indicator that glides between the active tab. tabs = [{id,label}] ── */
export function Tabs({ tabs, value, onChange, id = 'tabs', className }) {
  return (
    <div className={className} role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0' }}>
      {tabs.map(t => (
        <button
          key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          style={{ position: 'relative', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: value === t.id ? '#2563eb' : '#64748b' }}
        >
          {t.label}
          {value === t.id && (
            <motion.span layoutId={`${id}-ind`} transition={{ duration: DUR.base, ease: EASE }}
              style={{ position: 'absolute', left: 8, right: 8, bottom: -1, height: 2, borderRadius: 2, background: '#2563eb' }} />
          )}
        </button>
      ))}
    </div>
  );
}

/* ── skeleton shimmer block (CSS only, see .skel in globals.css) ── */
export function Skeleton({ w = '100%', h = 14, r = 8, style }) {
  return <span className="skel" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />;
}

export { motion, AnimatePresence, useReducedMotion };
