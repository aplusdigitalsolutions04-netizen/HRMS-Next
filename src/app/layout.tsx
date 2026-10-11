import type { Metadata, Viewport } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0f1a3a",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "HRMS", statusBarStyle: "black-translucent" },
  title: "HRMS-APDS",
  description: "A Plus Digital Solutions HRMS",
  icons: {
    icon: "/Apluslogo.jpg",
    shortcut: "/Apluslogo.jpg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
