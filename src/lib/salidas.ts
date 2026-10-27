import type { ItemInventarioSalida } from "./types";

/** Additional form fields live in the existing notes column, with a versioned envelope. */
export interface DatosRegistroSalida {
  version: 1;
  motivo: string;
  destino: string;
  estadoSalida: string;
  movilidad: string;
  lesionesSalida: string;
  estadoRegreso: string;
  lesionesRegreso: string;
  familiarRegreso: string;
  observaciones: string;
}

export type ArticuloSalida = ItemInventarioSalida & { regresado?: boolean; notas_regreso?: string };

export const DATOS_SALIDA_VACIOS: DatosRegistroSalida = {
  version: 1, motivo: "", destino: "", estadoSalida: "", movilidad: "", lesionesSalida: "",
  estadoRegreso: "", lesionesRegreso: "", familiarRegreso: "", observaciones: "",
};

export const CONFORMIDAD_SALIDA = "Al firmar este documento, el familiar responsable confirma que el inventario es correcto y que el residente salió/regresó en las condiciones descritas. Cualquier artículo no registrado aquí no podrá ser reclamado a la residencia.";

export function leerDatosSalida(notas: string | null): DatosRegistroSalida {
  if (!notas) return { ...DATOS_SALIDA_VACIOS };
  try {
    const parsed: unknown = JSON.parse(notas);
    if (parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 1) {
      const values = { ...DATOS_SALIDA_VACIOS };
      for (const key of Object.keys(values) as (keyof DatosRegistroSalida)[]) {
        if (key !== "version" && key in parsed && typeof parsed[key as keyof typeof parsed] === "string") {
          values[key] = parsed[key as keyof typeof parsed] as string;
        }
      }
      return values;
    }
  } catch { /* Existing plain-text notes remain readable. */ }
  return { ...DATOS_SALIDA_VACIOS, observaciones: notas };
}

export function validarFechasSalida(salida: string, regreso: string, horaSalida = "", horaRegreso = ""): string | null {
  if (!salida || !regreso) return "Indica las fechas de salida y regreso.";
  const esFecha = (fecha: string) => /^\d{4}-\d{2}-\d{2}$/.test(fecha) && Number.isFinite(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha;
  if (!esFecha(salida) || !esFecha(regreso)) return "Revisa las fechas del registro.";
  const dias = (Date.parse(regreso) - Date.parse(salida)) / 86400000;
  if (dias < 0 || (dias === 0 && horaSalida && horaRegreso && horaRegreso < horaSalida)) return "El regreso no puede ser anterior a la salida.";
  if (dias > 20) return "La salida no puede superar 20 días.";
  return null;
}
