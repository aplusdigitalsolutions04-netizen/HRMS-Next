// @ts-nocheck
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { HI, HI_ATTR } from './i18n-dict';

// Language switch (English / Hindi). The screens are written in English; when Hindi is on, every piece of
// text that exactly matches an entry in i18n-dict.ts is shown in Hindi, and everything else (names, numbers,
// anything not in the dictionary) stays as it is. Switching back to English restores the original text.
// Only what is on screen is changed - no data and no behaviour.

type Lang = 'en' | 'hi';
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} });
export const useLang = () => useContext(Ctx);

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT']);
const originals = new WeakMap<Node, string>();       // text node -> its English text
const attrOriginals = new WeakMap<Element, Record<string, string>>();
const ATTRS = ['placeholder', 'title', 'aria-label'];

function skipped(node: Node): boolean {
  let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement;
  while (el) {
    if (SKIP.has(el.tagName) || el.hasAttribute('data-no-translate')) return true;
    el = el.parentElement;
  }
  return false;
}

function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = w.nextNode())) out.push(n as Text);
  return out;
}

function toHindi(root: Node) {
  for (const t of textNodes(root)) {
    const raw = t.nodeValue || '';
    const key = raw.trim();
    if (!key || skipped(t)) continue;
    const hi = HI[key];
    if (hi) { originals.set(t, raw); t.nodeValue = raw.replace(key, hi); }
  }
  if (root.nodeType === 1 || root.nodeType === 9) {
    const base = (root.nodeType === 9 ? (root as Document).body : root) as Element;
    base.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
      if (skipped(el)) return;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v) continue;
        const hi = HI_ATTR[v] || HI[v];
        if (hi) { const o = attrOriginals.get(el) || {}; o[a] = v; attrOriginals.set(el, o); el.setAttribute(a, hi); }
      }
    });
  }
}

function toEnglish() {
  for (const t of textNodes(document.body)) {
    const o = originals.get(t);
    if (o !== undefined) { t.nodeValue = o; originals.delete(t); }
  }
  document.body.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
    const o = attrOriginals.get(el);
    if (!o) return;
    for (const [a, v] of Object.entries(o)) el.setAttribute(a, v);
    attrOriginals.delete(el);
  });
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  // remembered language (and the saved preference once signed in)
  useEffect(() => {
    try { const l = localStorage.getItem('hrms_lang'); if (l === 'hi' || l === 'en') setLangState(l); } catch {}
    const token = sessionStorage.getItem('token');
    if (token) {
      fetch('/api/preferences', { headers: { Authorization: 'Bearer ' + token } })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { const l = d && d.prefs && d.prefs.lang; if (l === 'hi' || l === 'en') { setLangState(l); try { localStorage.setItem('hrms_lang', l); } catch {} } })
        .catch(() => {});
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('hrms_lang', l); } catch {}
    const token = sessionStorage.getItem('token');
    if (token) fetch('/api/preferences', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: l }) }).catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === 'en') { toEnglish(); return; }
    toHindi(document.body);
    let queued = false;
    const pending: Node[] = [];
    const flush = () => {
      queued = false;
      const nodes = pending.splice(0);
      obs.disconnect();                                    // our own edits must not trigger more work
      for (const n of nodes) { if (n.isConnected) toHindi(n.nodeType === 3 ? (n.parentNode || n) : n); }
      obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') pending.push(m.target);
        else m.addedNodes.forEach(n => pending.push(n));
      }
      if (!queued) { queued = true; requestAnimationFrame(flush); }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [lang]);

  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}
