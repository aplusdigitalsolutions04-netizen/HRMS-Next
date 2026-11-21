// The settings the pages need for formatting and for checking files (Settings > Rules & Limits). They are loaded once when the program
// opens (see ClientLayout), so the helpers below can be used anywhere without waiting. The values here are only used if the load fails.
const FALLBACK = { currency_symbol: '\u20B9', locale: 'en-IN', upload_shrink_above_mb: 1.2, upload_one_file_mb: 8, upload_total_mb: 20, register_photo_kb: 100, register_pdf_mb: 2, register_doc_mb: 5 };
let loaded = null;

export async function loadAppConfig() {
  try {
    const r = await fetch('/api/app-config');
    if (r.ok) loaded = await r.json();
  } catch { /* the fallback values are used */ }
  return appConfig();
}
export const appConfig = () => ({ ...FALLBACK, ...(loaded || {}) });
export const appLocale = () => appConfig().locale;
export const currencySymbol = () => appConfig().currency_symbol;
export const MBYTES = 1024 * 1024;
