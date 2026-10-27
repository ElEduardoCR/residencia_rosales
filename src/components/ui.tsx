import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
    <div><h1 className="page-title">{title}</h1>{subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>}</div>
    {action}
  </div>;
}

export function EmptyState({ icon, title, hint, action }: { icon?: string; title: string; hint?: string; action?: React.ReactNode }) {
  return <div className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <div className="icon-tile mb-1" aria-hidden="true">{icon ? <span className="text-xl">{icon}</span> : <Icon name="clipboard" />}</div>
    <h3 className="font-semibold tracking-tight text-slate-800">{title}</h3>
    {hint && <p className="max-w-sm text-sm leading-relaxed text-slate-500">{hint}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>;
}

export function Stat({ label, value, hint, href, tono = "slate", icon }: { label: string; value: string | number; hint?: string; href?: string; tono?: "slate" | "marca" | "amber" | "emerald" | "sky"; icon?: IconName }) {
  const tonos = { slate: "text-slate-900", marca: "text-marca-700", amber: "text-amber-700", emerald: "text-emerald-700", sky: "text-sky-700" };
  const contenido = <div className={`card h-full p-5 ${href ? "transition hover:border-marca-300 hover:shadow-md" : ""}`}>
    <div className="mb-4 flex items-start justify-between gap-3"><span className="text-sm font-medium text-slate-500">{label}</span>{icon && <Icon name={icon} className="shrink-0 text-slate-400" />}</div>
    <div className={`text-[2.2rem] leading-none font-semibold tracking-tight tabular-nums ${tonos[tono]}`}>{value}</div>
    {hint && <div className="mt-3 text-xs text-slate-500">{hint}</div>}
  </div>;
  return href ? <Link className="block rounded-[22px]" href={href}>{contenido}</Link> : contenido;
}
