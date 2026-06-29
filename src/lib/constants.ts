import type { Turno } from "./types";

/** Mililitros por vaso de agua. */
export const ML_POR_VASO = 235;

export const TURNOS: { value: Turno; label: string }[] = [
  { value: "matutino", label: "Matutino" },
  { value: "vespertino", label: "Vespertino" },
  { value: "nocturno", label: "Nocturno" },
];

export const TURNOS_PERSONAL = [
  { value: "matutino", label: "Matutino" },
  { value: "vespertino", label: "Vespertino" },
  { value: "nocturno", label: "Nocturno" },
  { value: "mixto", label: "Mixto" },
];

export const TIPOS_SANGRE = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
];

export const SEXOS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "Otro", label: "Otro" },
];

export const DIAS_SEMANA = [
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
  { value: "domingo", label: "Domingo" },
];

// Días para actividades programadas (0=domingo .. 6=sábado, como JS getDay()).
export const DIAS_NUM = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 0, label: "Dom" },
];

export const TIEMPOS_COMIDA = [
  { value: "desayuno", label: "Desayuno" },
  { value: "colacion_matutina", label: "Colación matutina" },
  { value: "comida", label: "Comida" },
  { value: "colacion_vespertina", label: "Colación vespertina" },
  { value: "cena", label: "Cena" },
];

export const PARENTESCOS = [
  "Hijo(a)", "Esposo(a)", "Hermano(a)", "Nieto(a)", "Sobrino(a)",
  "Padre", "Madre", "Tutor legal", "Amigo(a)", "Otro",
];

export const TIPOS_MEDICAMENTO = [
  { value: "pastilla", label: "Pastilla (pieza)", unidad: "pieza" },
  { value: "ml", label: "Líquido (ml)", unidad: "ml" },
  { value: "otro", label: "Otro", unidad: "unidad" },
];

/** Artículos estándar que el paciente puede llevarse al salir. */
export const ITEMS_SALIDA_DEFAULT = [
  "Lentes",
  "Aparato auditivo",
  "Documentos",
  "Andador",
  "Bastón",
  "Ropa",
  "Medicamentos",
  "Placas dentales",
];

export const COMIDAS_DIA = [
  { key: "almuerzo", label: "Almuerzo" },
  { key: "comida", label: "Comida" },
  { key: "cena", label: "Cena" },
  { key: "colacion_matutina", label: "Colación matutina" },
  { key: "colacion_vespertina", label: "Colación vespertina" },
] as const;
