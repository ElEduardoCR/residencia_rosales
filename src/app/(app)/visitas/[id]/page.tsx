import { redirect } from "next/navigation";

export default async function SalidaAnterior({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/salidas/${encodeURIComponent(id)}`);
}
