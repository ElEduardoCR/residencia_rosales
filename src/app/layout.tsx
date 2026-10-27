import type { Metadata, Viewport } from "next";
import { ThemePreferences } from "@/components/ThemeToggle";
import { THEME_BOOTSTRAP } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Residencia Rosales",
  description: "Sistema de gestión de la Residencia Rosales",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Rosales", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f4f9" }, { media: "(prefers-color-scheme: dark)", color: "#17141e" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} /></head>
      <body className="min-h-full"><ThemePreferences />{children}</body>
    </html>
  );
}
