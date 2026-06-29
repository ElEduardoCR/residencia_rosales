import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="font-semibold text-slate-700">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
  tono = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tono?: "slate" | "marca" | "amber" | "emerald" | "sky";
}) {
  const tonos: Record<string, string> = {
    slate: "text-slate-900",
    marca: "text-marca-700",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
    sky: "text-sky-600",
  };
  const contenido = (
    <div className="card p-5 transition hover:shadow-md">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${tonos[tono]}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{contenido}</Link> : contenido;
}
