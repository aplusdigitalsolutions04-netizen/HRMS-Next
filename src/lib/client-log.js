// Reports what the browser itself sees go wrong - a call to the server that could not be sent (no connection, server not reachable)
// and script errors - to the API Logs (POST /api/client-log). Report that cannot be sent is kept and sent on the next page load.
import Swal from 'sweetalert2';
import { friendlyError, friendlyText } from './friendly-error';

const KEY = 'apiLogPending';
let installed = false;

function send(items) {
  const token = sessionStorage.getItem('token');
  if (!token || items.length === 0) return Promise.resolve(false);
  return window.__plainFetch('/api/client-log', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ items }), keepalive: true,
  }).then(r => r.ok).catch(() => false);
}

function keep(item) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.push(item);
    localStorage.setItem(KEY, JSON.stringify(list.slice(-30)));
  } catch { /* storage not available */ }
}

export function installClientLog() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.__plainFetch = window.fetch.bind(window);

  let leaving = false;
  window.addEventListener('beforeunload', () => { leaving = true; });
  let sentThisMinute = 0;
  setInterval(() => { sentThisMinute = 0; }, 60000);

  const report = (item) => {
    if (leaving || sentThisMinute >= 10) return;
    sentThisMinute++;
    send([item]).then(ok => { if (!ok) keep(item); });
  };

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    return window.__plainFetch(input, init).catch(err => {
      if (err && err.name === 'AbortError') throw err;
      if (url.startsWith('/api/') && !url.startsWith('/api/client-log')) {
        report({ method, url, page: location.pathname, message: (err && err.message) || 'The request could not be sent', detail: err && err.stack });
      }
      // what the person sees is a plain sentence; the real message went to the API Logs above
      const plain = new Error('Could not reach the server. Please check the connection and try again.');
      plain.name = (err && err.name) || 'Error';
      throw plain;
    });
  };

  // an answer that is not readable JSON (for example a page from the hosting when the server is down)
  const plainJson = Response.prototype.json;
  Response.prototype.json = function () {
    return plainJson.call(this).catch(err => {
      if (err && err.name === 'SyntaxError') {
        report({ url: this.url || '', page: location.pathname, message: 'The server sent an answer that is not readable: ' + (err.message || ''), detail: 'HTTP ' + this.status });
        throw new Error('The server sent an unexpected answer. Please try again.');
      }
      throw err;
    });
  };

  // popups and alerts: an error message is shown only in plain words
  const plainFire = Swal.fire.bind(Swal);
  Swal.fire = function (...args) {
    try {
      const first = args[0];
      if (first && typeof first === 'object') {
        if (first.icon === 'error') {
          const o = { ...first };
          if (typeof o.text === 'string') o.text = friendlyText(o.text);
          if (typeof o.html === 'string' && friendlyError(o.html).technical) o.html = friendlyText(o.html);
          if (typeof o.footer === 'string') o.footer = friendlyText(o.footer);
          args[0] = o;
        }
      } else if (args[2] === 'error' && typeof args[1] === 'string') {
        args[1] = friendlyText(args[1]);
      }
    } catch { /* show it as it is */ }
    return plainFire(...args);
  };
  const plainAlert = window.alert.bind(window);
  window.alert = function (msg) { return plainAlert(friendlyText(msg)); };

  window.addEventListener('error', (e) => report({ page: location.pathname, message: e.message || 'Script error', detail: e.error && e.error.stack ? e.error.stack : `${e.filename || ''}:${e.lineno || ''}` }));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (r && r.name === 'AbortError') return;
    report({ page: location.pathname, message: (r && r.message) || String(r || 'Unhandled error'), detail: r && r.stack });
  });

  // anything kept from an earlier visit
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (list.length) { localStorage.removeItem(KEY); send(list).then(ok => { if (!ok) list.forEach(keep); }); }
  } catch { /* nothing kept */ }
}
