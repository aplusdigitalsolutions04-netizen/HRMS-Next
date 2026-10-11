import { useEffect, useRef } from 'react';

// Keeps a screen up to date without the person pressing refresh. `fn` is the screen's own "load the data" function;
// it is called again every `every` ms and when the person comes back to the tab, but only while:
//   - the tab is visible, and
//   - nobody is typing in a box, and no dialog / popup is open (so a refresh never wipes what is being written).
// Pass a function that refreshes quietly (no loading spinner) so the screen does not blink.
export default function useLiveRefresh(fn, every = 20000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const busy = () => {
      const a = document.activeElement;
      if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio') return true;
      return !!(document.querySelector('.swal2-container') || document.querySelector('[role="dialog"]'));
    };
    const run = () => { if (document.hidden || busy()) return; try { ref.current && ref.current(); } catch { /* the screen handles its own errors */ } };
    const timer = setInterval(run, every);
    const back = () => { if (!document.hidden) run(); };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('focus', back);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back); };
  }, [every]);
}
