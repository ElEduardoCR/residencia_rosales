const REVISION_PENDIENTE = "Requiere revisión documental. Sin turnos programados; validar la indicación antes de administrar.";
const CONTEO_PENDIENTE = "Existencias no verificadas.";

export function existenciasSinVerificar(notas: string | null | undefined): boolean {
  return /^Existencias no verificadas\b/im.test(notas ?? "");
}

export function indicacionSinRevisar(notas: string | null | undefined): boolean {
  return /requiere revisión documental/i.test(notas ?? "");
}

export function esRegistroDocumental(notas: string | null | undefined): boolean {
  return /^Fuente documental:/im.test(notas ?? "") || existenciasSinVerificar(notas) || indicacionSinRevisar(notas);
}

/** Change only administrative marker lines, leaving source quotations and clinical text intact. */
export function actualizarNotasVerificacion({
  notas,
  notasOriginales,
  existenciasVerificadas,
  dosisYHorariosRevisados,
  fecha,
}: {
  notas: string;
  notasOriginales: string | null;
  existenciasVerificadas: boolean;
  dosisYHorariosRevisados: boolean;
  fecha: string;
}): string | null {
  if (!esRegistroDocumental(notasOriginales) && !esRegistroDocumental(notas)) return notas || null;
  let lineas = notas.split(/\r?\n/);
  const originales = (notasOriginales ?? "").split(/\r?\n/);
  const esConteo = (linea: string) => /^Existencias no verificadas(?:\.|$)/i.test(linea.trim());
  const esRevision = (linea: string) => [REVISION_PENDIENTE.toLowerCase(), "requiere revisión documental."].includes(linea.trim().toLowerCase());
  if (existenciasVerificadas) {
    const antesSinConteo = existenciasSinVerificar(notasOriginales) || existenciasSinVerificar(notas);
    lineas = lineas.filter(linea => !esConteo(linea));
    if (antesSinConteo) lineas.push(`Existencias verificadas mediante conteo el ${fecha}.`);
  } else if (!lineas.some(esConteo)) {
    lineas.push(originales.find(esConteo) ?? CONTEO_PENDIENTE);
  }
  if (dosisYHorariosRevisados) {
    const antesPendiente = indicacionSinRevisar(notasOriginales) || indicacionSinRevisar(notas);
    lineas = lineas.filter(linea => !esRevision(linea));
    if (antesPendiente) lineas.push(`Dosis y horarios revisados manualmente el ${fecha}.`);
  } else if (!lineas.some(esRevision)) {
    lineas.unshift(originales.find(esRevision) ?? REVISION_PENDIENTE);
  }
  return lineas.join("\n").trim() || null;
}
