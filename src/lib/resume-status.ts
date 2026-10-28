import { existsSync } from 'fs';
import { join } from 'path';

// True when a candidate's resume was saved on the server's disk and the file is no longer there (a new deploy can clear the
// folder). A resume on Google Drive ("drive:<id>") or no resume at all is not reported.
export function resumeMissing(path: any): boolean {
  const p = String(path || '').split('\\').join('/');
  if (!/^uploads\/documents\/[^/]+$/.test(p)) return false;
  try { return !existsSync(join(process.cwd(), 'public', p)); } catch { return false; }
}
