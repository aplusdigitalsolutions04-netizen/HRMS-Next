import type { MetadataRoute } from 'next';

// Makes the app installable ("Add to home screen") on phones and desktops.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HRMS - A Plus Digital Solutions',
    short_name: 'HRMS',
    description: 'Attendance, leave, payslips and more - in one place.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f3f5fb',
    theme_color: '#0f1a3a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
