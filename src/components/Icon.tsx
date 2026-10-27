import type { SVGProps } from "react";

export type IconName = "home" | "patients" | "clipboard" | "visits" | "exit" | "menu" | "staff" | "plus" | "arrow" | "close" | "bars" | "heart" | "clock" | "pill" | "check" | "calendar" | "lock";
const paths: Record<IconName, React.ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  patients: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="18" rx="3" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="m9 13 2 2 4-4M9 18h6" /></>,
  visits: <><path d="M21 11a8 8 0 0 1-8 8H8l-5 3 1.5-6A8 8 0 1 1 21 11Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
  exit: <path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M9 12h12m-5-5 5 5-5 5" />,
  menu: <path d="M4 3v5a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 0-5 8-5 11h5" />,
  staff: <><path d="M6 3v6a6 6 0 0 0 12 0V3M4 3h4m8 0h4M12 15v2a4 4 0 0 0 8 0v-2" /><circle cx="20" cy="13" r="2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  bars: <path d="M4 6h16M4 12h16M4 18h16" />,
  heart: <path d="m12 21-8-8C-3 6 6-2 12 5c6-7 15 1 8 8Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pill: <><path d="m9 4-5 5a6 6 0 0 0 8.5 8.5l5-5A6 6 0 0 0 9 4Z" /><path d="m7 7 8.5 8.5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-14 5h3m4 0h3" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>,
};
export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
