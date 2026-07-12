// Tipos de la base de datos (Residencia Rosales)

export type Turno = "matutino" | "vespertino" | "nocturno";
export type TipoMedicamento = "pastilla" | "ml" | "otro";

export type Rol = "admin" | "enfermero";

export interface Personal {
  id: string;
  user_id: string | null;
  nombre: string;
  rol: Rol;
  puesto: string | null;
  turno: "matutino" | "vespertino" | "nocturno" | "mixto" | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  contacto_emergencia: string | null;
  contacto_emergencia_tel: string | null;
  cedula: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicamentoCatalogo {
  id: number;
  nombre: string;
  principio: string | null;
  forma: string | null;
  tipo: TipoMedicamento;
}

export interface InventarioMedicamento {
  id: string;
  catalogo_id: number | null;
  nombre: string;
  tipo: TipoMedicamento;
  unidad: string;
  cantidad: number;
  minimo: number;
  ubicacion: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventarioPaciente {
  id: string;
  paciente_id: string;
  catalogo_id: number | null;
  nombre: string;
  tipo: TipoMedicamento;
  unidad: string;
  dosis: string | null;
  cantidad: number;
  minimo: number;
  maximo: number | null;
  lugar_compra: string | null;
  ubicacion: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paciente {
  id: string;
  foto_url: string | null;
  nombre: string;
  sexo: "M" | "F" | "Otro" | null;
  tipo_sangre: string | null;
  fecha_nacimiento: string | null;
  alergias: string[];
  enfermedades: string[];
  tutor_nombre: string | null;
  tutor_parentesco: string | null;
  tutor_contacto: string | null;
  peso: number | null;
  talla: number | null;
  estatura: number | null;
  imc: number | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicamentoPaciente {
  id: string;
  paciente_id: string;
  inventario_id: string | null;
  medicamento_nombre: string;
  dosis: string | null;
  frecuencia: string | null;
  turnos: Turno[];
  presentacion: string | null;
  cantidad: number;
  minimo: number;
  maximo: number | null;
  lugar_compra: string | null;
  activo: boolean;
  notas: string | null;
  created_at: string;
}

export interface RegistroTurno {
  id: string;
  paciente_id: string;
  fecha: string;
  turno: Turno;
  evacuaciones: number;
  orina: number;
  enfermero_id: string | null;
  notas: string | null;
}

export interface RegistroAlimentacion {
  id: string;
  paciente_id: string;
  fecha: string;
  almuerzo: boolean;
  comida: boolean;
  cena: boolean;
  colacion_matutina: boolean;
  colacion_vespertina: boolean;
  vasos_agua: number;
  enfermero_id: string | null;
  notas: string | null;
}

export interface AdministracionMedicamento {
  id: string;
  paciente_id: string;
  fecha: string;
  turno: Turno | null;
  hora: string | null;
  inventario_id: string | null;
  medicamento_nombre: string;
  tipo: "obligatorio" | "extra";
  dosis: string | null;
  motivo: string | null;
  enfermero_id: string | null;
  created_at: string;
}

export interface Visita {
  id: string;
  paciente_id: string | null;
  visitante_nombre: string;
  parentesco: string | null;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  motivo: string | null;
  created_at: string;
}

export interface ItemInventarioSalida {
  nombre: string;
  llevado: boolean;
  notas?: string;
}

export interface Salida {
  id: string;
  paciente_id: string;
  quien_lo_lleva: string;
  parentesco: string | null;
  fecha_salida: string;
  hora_salida: string | null;
  fecha_regreso_estimada: string | null;
  fecha_regreso: string | null;
  hora_regreso: string | null;
  inventario: ItemInventarioSalida[];
  condicion_fisica_salida: string | null;
  condicion_fisica_regreso: string | null;
  firma_salida_url: string | null;
  firma_regreso_url: string | null;
  enfermero_entrega_id: string | null;
  enfermero_recibe_id: string | null;
  firma_salida_enfermero_url: string | null;
  firma_regreso_enfermero_url: string | null;
  estado: "fuera" | "regresado";
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuSemanal {
  id: string;
  dia: string;
  tiempo: string;
  descripcion: string;
}

export interface ActividadProgramada {
  id: string;
  titulo: string;
  descripcion: string | null;
  paciente_id: string | null;
  hora: string; // "HH:MM:SS"
  dias_semana: number[]; // 0=domingo .. 6=sábado
  activo: boolean;
  creado_por: string | null;
  created_at: string;
}

export interface ActividadCompletada {
  id: string;
  actividad_id: string;
  fecha: string;
  completada_at: string;
  enfermero_id: string | null;
  a_tiempo: boolean;
  motivo_retraso: string | null;
  notas: string | null;
}
