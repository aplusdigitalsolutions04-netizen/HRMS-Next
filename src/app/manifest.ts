import type { MetadataRoute } from 'next';
import { query } from '@/lib/db';
import { getConfig } from '@/lib/app-config';

// Makes the app installable ("Add to home screen") on phones and desktops.
export const dynamic = 'force-dynamic';
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let short = 'HRMS', company = '', tab = '';
  try {
    const cfg = await getConfig();
    short = cfg.app_short_name;
    tab = String(cfg.app_tab_title || '').trim();
    company = ((await query('SELECT company_name FROM company_settings LIMIT 1')) as any[])[0]?.company_name || '';
  } catch {}
  return {
    name: tab || (company ? `${short} - ${company}` : short),
    short_name: short,
    description: 'Attendance, leave, payslips and more - in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f6f1ec',
    theme_color: '#2a1c13',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
