import type { Metadata } from "next";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "HRMS-APDS",
  description: "A Plus Digital Solutions HRMS",
  icons: {
    icon: "/Apluslogo.jpg",
    shortcut: "/Apluslogo.jpg",
    apple: "/Apluslogo.jpg",
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
