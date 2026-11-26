import React, { useRef } from 'react';
import Swal from 'sweetalert2';

// "Add link" under an email text box: type the words to show and the web address, and the link is put where the cursor is.
// (In the text it is written as [words](address); the mail shows the words as a link that can be clicked.)
// Put it right after the <textarea>, inside the same parent: it finds the text box itself.
export default function AddLinkButton({ label = 'Add link', style }) {
  const btn = useRef(null);
  const run = async () => {
    const box = btn.current && btn.current.parentElement && btn.current.parentElement.querySelector('textarea');
    if (!box) return;
    const start = box.selectionStart ?? box.value.length, end = box.selectionEnd ?? start;
    const picked = box.value.slice(start, end);
    const r = await Swal.fire({
      title: 'Add a link',
      html: '<div style="text-align:left;font-size:13px;font-weight:600;margin:6px 0 3px">Words to show</div><input id="lnk-t" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box" placeholder="For example: Open in Google Maps">'
        + '<div style="text-align:left;font-size:13px;font-weight:600;margin:12px 0 3px">Web address</div><input id="lnk-u" class="swal2-input" style="margin:0;width:100%;box-sizing:border-box" placeholder="https://maps.app.goo.gl/...">',
      didOpen: () => { const t = document.getElementById('lnk-t'); if (picked) t.value = picked; (picked ? document.getElementById('lnk-u') : t).focus(); },
      showCancelButton: true, confirmButtonText: 'Add the link',
      preConfirm: () => {
        const t = document.getElementById('lnk-t').value.trim().replace(/[\[\]\n]/g, ' ');
        let u = document.getElementById('lnk-u').value.trim();
        if (!t) { Swal.showValidationMessage('Type the words to show'); return false; }
        if (!u) { Swal.showValidationMessage('Type the web address'); return false; }
        if (!/^(https?:\/\/|mailto:)/i.test(u)) u = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u) ? 'mailto:' + u : 'https://' + u;
        if (/[\s)]/.test(u)) { Swal.showValidationMessage('The web address cannot have spaces'); return false; }
        return { t, u };
      },
    });
    if (!r.isConfirmed) return;
    const text = `[${r.value.t}](${r.value.u})`;
    const next = box.value.slice(0, start) + text + box.value.slice(end);
    // set the value the way typing does, so the page's own state follows
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(box, next);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.focus();
    box.setSelectionRange(start + text.length, start + text.length);
  };
  return <button type="button" ref={btn} onClick={run} style={{ marginTop: 6, border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: 8, padding: '5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', color: '#334155', fontFamily: 'inherit', ...style }}>&#128279; {label}</button>;
}
