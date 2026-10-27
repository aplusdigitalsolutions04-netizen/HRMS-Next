import Swal from 'sweetalert2';

// Opens or downloads a candidate's resume. The file is fetched with the login token (the resume route is protected),
// then shown from a temporary browser URL.
export async function openResume(path, { download = false } = {}) {
  if (!path) { Swal.fire('Resume not available'); return; }
  // a PDF opens in a tab; open the tab now so the browser does not block it as a popup
  const tab = download ? null : window.open('', '_blank');
  const isWord = /\.docx?$/i.test(path);
  try {
    // a browser cannot show a Word file itself, so for viewing the server sends it as a web page
    const res = await fetch(`/api/resume/file?path=${encodeURIComponent(path)}${download ? '&download=1' : isWord ? '&format=html' : ''}`, { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('token') } });
    if (!res.ok) { let m = 'Could not open the resume'; try { m = (await res.json()).detail || m; } catch {} throw new Error(m); }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const isPdfOrImage = /pdf|image|html/.test(blob.type);
    if (!download && isPdfOrImage && tab) { tab.location.href = url; }
    else {
      if (tab) tab.close();
      const a = document.createElement('a');
      a.href = url; a.download = path.split('/').pop(); document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    if (tab) tab.close();
    Swal.fire({ icon: 'error', title: 'Resume', text: e.message });
  }
}
