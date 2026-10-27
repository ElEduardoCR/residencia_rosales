"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const THEME_CHANGED = "rosales-theme-changed";

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", theme === "dark" ? "#17141e" : "#f6f4f9");
  });
  window.dispatchEvent(new Event(THEME_CHANGED));
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_CHANGED, callback);
  return () => window.removeEventListener(THEME_CHANGED, callback);
}

function serverTheme(): Theme { return "light"; }

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);
  const label = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    // Keep the switch usable even when browser storage is unavailable.
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Session-only preference. */ }
    applyTheme(next);
  }

  return <button type="button" className={`btn btn-secondary theme-toggle ${className}`} onClick={toggle} aria-label={label} title={label}>
    <svg className="theme-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>
    <svg className="theme-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 13.1A9 9 0 0 1 10.9 3 9 9 0 1 0 21 13.1Z" /></svg>
    <span className="theme-sun">Modo claro</span><span className="theme-moon">Modo oscuro</span>
  </button>;
}

/** System appearance applies until the person chooses a mode explicitly. */
export function ThemePreferences() {
  const pathname = usePathname();
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyTheme(storedTheme() ?? (system.matches ? "dark" : "light"));
    const syncStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) sync();
    };
    sync();
    system.addEventListener("change", sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      system.removeEventListener("change", sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, []);

  return pathname === "/login" || pathname.startsWith("/visitante")
    ? <div className="public-theme-toggle no-print"><ThemeToggle /></div>
    : null;
}
