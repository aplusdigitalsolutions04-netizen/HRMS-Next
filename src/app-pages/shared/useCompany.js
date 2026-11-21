import { useState, useEffect } from 'react';

// The company name and contact email from Company Settings (public, so it works before sign-in). Kept for the session.
let cache = null;
export function useCompany() {
  const [c, setC] = useState(cache || { company_name: '', company_email: '' });
  useEffect(() => {
    if (cache) return;
    fetch('/api/company-public').then(r => r.json()).then(d => { cache = d; setC(d); }).catch(() => {});
  }, []);
  return c;
}
