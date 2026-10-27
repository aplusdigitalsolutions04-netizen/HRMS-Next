import Swal from 'sweetalert2';

// Single place that knows how to fetch and open an employee document.
// Always goes through a normal Authorization-header fetch (never a bare
// <a href> with the JWT in the query string, which would leak it into
// server logs/browser history/Referer headers) and opens the result as a
// blob URL in a new tab.
export async function openEmployeeDocument(employeeId, field) {
  try {
    const res = await fetch(`/api/employee/document/${employeeId}?field=${field}`, {
      headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') },
    });
    if (!res.ok) {
      Swal.fire('Error', 'Could not open document', 'error');
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  } catch {
    Swal.fire('Error', 'Could not open document', 'error');
  }
}

// In-page preview: the file is fetched with the login token and shown in a window over the current page
// (PDF and images; other types, such as Word files, can only be downloaded). The person stays on the same screen.
export async function previewDocumentUrl(url, title = 'Document') {
  try {
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } });
    if (!res.ok) {
      let msg = 'Could not open the document';
      try { msg = (await res.json()).detail || msg; } catch { /* not json */ }
      Swal.fire({ icon: 'error', title: 'Preview', text: msg });
      return;
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const type = blob.type || '';
    // a Word resume: the server turns it into a page that can be shown here
    let wordHtml = '';
    if (/word/.test(type) && url.includes('/api/resume/file')) {
      const w = await fetch(url + '&format=html', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } });
      if (w.ok) wordHtml = await w.text();
    }
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    let html;
    if (wordHtml) html = `<iframe sandbox="" srcdoc="${wordHtml.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" title="${esc(title)}" style="width:100%;height:72vh;border:1px solid #e2e8f0;border-radius:8px;background:#fff"></iframe>`;
    else if (/pdf/.test(type)) html = `<iframe src="${objUrl}" title="${esc(title)}" style="width:100%;height:72vh;border:1px solid #e2e8f0;border-radius:8px"></iframe>`;
    else if (/^image\//.test(type)) html = `<div style="max-height:72vh;overflow:auto;text-align:center"><img src="${objUrl}" alt="${esc(title)}" style="max-width:100%;border-radius:8px" /></div>`;
    else html = `<p style="color:#64748b;margin:18px 0">This file type cannot be previewed in the browser. Use Download to open it.</p>`;
    const r = await Swal.fire({
      title: esc(title), html, width: 'min(980px, 96vw)', showCloseButton: true, showCancelButton: true,
      confirmButtonText: 'Download', cancelButtonText: 'Close', confirmButtonColor: '#2563eb',
    });
    if (r.isConfirmed) {
      const a = document.createElement('a');
      a.href = objUrl; a.download = title; document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
  } catch {
    Swal.fire({ icon: 'error', title: 'Preview', text: 'Could not open the document' });
  }
}

export const previewEmployeeDocument = (employeeId, field, title) => previewDocumentUrl(`/api/employee/document/${employeeId}?field=${field}`, title);
