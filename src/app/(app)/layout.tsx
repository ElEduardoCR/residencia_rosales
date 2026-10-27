import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) redirect("/login");

  return (
    <div className="min-h-screen md:flex">
      <a className="skip-link" href="#contenido-principal">Ir al contenido</a>
      <Sidebar email={usuario.email} nombre={usuario.nombre} esAdmin={usuario.esAdmin} />
      <main id="contenido-principal" tabIndex={-1} className="app-main min-w-0 flex-1 outline-none md:ml-[280px]">
        <div className="mx-auto max-w-[1360px] px-4 py-7 sm:px-6 md:px-8 md:py-10 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
