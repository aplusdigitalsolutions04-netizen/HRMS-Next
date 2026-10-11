// The documents an employee can upload while completing their profile. `key` is the form field the
// onboarding page uses, `column` is where the file path is stored on the employee row.
export const DOC_OPTIONS: { key: string; label: string; column: string }[] = [
  { key: 'IdentityProof', label: 'Identity Proof', column: 'identity_proof' },
  { key: 'AddressProof', label: 'Address Proof', column: 'address_proof' },
  { key: 'Resume', label: 'Resume', column: 'resume_path' },
  { key: 'UGDegree', label: 'UG Degree', column: 'ug_document' },
  { key: 'Marksheet10', label: '10th Marksheet', column: 'marksheet10' },
  { key: 'Marksheet12', label: '12th Marksheet', column: 'marksheet12' },
  { key: 'OfferLetter', label: 'Offer Letter', column: 'offer_letter' },
  { key: 'PGDegree', label: 'PG Degree', column: 'pg_document' },
  { key: 'AppointmentLetter', label: 'Appointment Letter', column: 'appointment_letter' },
  { key: 'InternshipCertificate', label: 'Internship Certificate', column: 'internship_certificate' },
  { key: 'Photograph', label: 'Photograph', column: 'photograph' },
  { key: 'BankDocument', label: 'Bank Document', column: 'bank_document' },
];

const VALID = new Set(DOC_OPTIONS.map(d => d.key));

// Only known document keys, no duplicates, in the standard order.
export function cleanRequiredDocs(input: any): string[] {
  const arr: string[] = Array.isArray(input) ? input.map(String) : [];
  return DOC_OPTIONS.map(d => d.key).filter(k => arr.includes(k) && VALID.has(k));
}

export function parseRequiredDocs(text: any): string[] {
  if (!text) return [];
  try { return cleanRequiredDocs(JSON.parse(String(text))); } catch { return []; }
}

export function docLabels(keys: string[]): string[] {
  return keys.map(k => DOC_OPTIONS.find(d => d.key === k)?.label || k);
}

// HTML block for emails: "These documents are compulsory: ..."
export function requiredDocsHtml(keys: string[]): string {
  if (keys.length === 0) return '';
  return `<div style="margin-top:18px;padding:12px 14px;border:1px solid #fde68a;background:#fffbeb;border-radius:8px;font-size:14px">
    <strong>Documents you must upload</strong> while completing your profile:
    <ul style="margin:8px 0 0 18px;padding:0">${docLabels(keys).map(l => `<li>${l}</li>`).join('')}</ul>
  </div>`;
}
