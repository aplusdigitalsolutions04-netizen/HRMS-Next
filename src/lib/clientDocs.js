import Swal from 'sweetalert2';

// Single place that knows how to fetch and open an employee document.
// Always goes through a normal Authorization-header fetch (never a bare
// <a href> with the JWT in the query string, which would leak it into
// server logs/browser history/Referer headers) and opens the result as a
// blob URL in a new tab.
export async function openEmployeeDocument(employeeId, field) {
  try {
    const res = await fetch(`/api/employee/document/${employeeId}?field=${field}`, {
      headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
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
