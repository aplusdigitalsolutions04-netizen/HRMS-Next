import type { Metadata, Viewport } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";
import "./dark-theme.css";
import { query } from "@/lib/db";
import { getConfig } from "@/lib/app-config";

export const viewport: Viewport = {
  themeColor: "#2a1c13",
  width: "device-width",
  initialScale: 1,
};

// The name in the browser tab comes from Rules & Limits (program name) and Company Settings (company name).
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  let short = "HRMS", company = "", tab = "";
  try {
    const cfg = await getConfig();
    short = cfg.app_short_name;
    tab = String(cfg.app_tab_title || "").trim();
    company = ((await query("SELECT company_name FROM company_settings LIMIT 1")) as any[])[0]?.company_name || "";
  } catch {}
  const title = tab || (company ? `${short} - ${company}` : short);
  return {
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: short, statusBarStyle: "black-translucent" },
    title,
    description: company ? `${company} ${short}` : short,
    icons: {
      icon: "/Apluslogo.jpg",
      shortcut: "/Apluslogo.jpg",
      apple: "/icons/apple-touch-icon.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* sets the saved light or dark mode before the page is drawn (not on the login pages, which stay light) */}
        <script dangerouslySetInnerHTML={{ __html: "try{var p=location.pathname,pub=['/login','/register','/privacy-policy','/terms-conditions','/force-change-password'],skip=false;for(var k=0;k<pub.length;k++){if(p.indexOf(pub[k])===0)skip=true}if(!skip){var t=localStorage.getItem('theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
