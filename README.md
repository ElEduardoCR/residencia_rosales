# 🌹 Residencia Rosales

Sistema de gestión interna para una residencia / casa de retiro. Construido con
**Next.js 16**, **React 19**, **Tailwind CSS v4** y **Supabase** (base de datos,
autenticación y almacenamiento). Listo para desplegar en **Vercel**.

## Funcionalidades

1. **Autenticación** con Supabase Auth (correo y contraseña).
2. **Inventario de medicamentos** por pastilla y ml, con punto de resurtido
   (mínimos) y catálogo de **12,800+ medicamentos** para autocompletar.
3. **Pacientes**: foto, tipo de sangre, fecha de nacimiento, alergias y
   enfermedades (varias), tutor y contacto, peso, talla, estatura e **IMC** automático.
4. **Actividades por turno** (matutino / vespertino / nocturno):
   - Evacuaciones y orina (enteros) con enfermero responsable.
   - Alimentación: almuerzo, comida, cena, 2 colaciones y vasos de agua (235 ml c/u).
   - Administración de medicamentos **obligatorios** y **extra** (con motivo).
5. **Visitas y salidas**: registro de visitantes y salidas con el tutor
   (máx. 20 días), inventario que lleva el paciente, condición física de salida
   y regreso, y **firma con el dedo**.
6. **Menú semanal** editable.
7. **Personal**: nombre, turno y datos de contacto del enfermero.

---

## 🚀 Puesta en marcha

### 1. Crear el proyecto en Supabase
1. Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key
   - `service_role` key (secreta)
3. Ve a **Project Settings → Database → Connection string → URI** y copia la cadena.

### 2. Configurar las credenciales
Copia `.env.example` a `.env.local` y completa los valores (ver `.env.local`).

### 3. Crear la base de datos
Ejecuta en el **SQL Editor** de Supabase, en este orden:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — tablas, seguridad, storage y menú.
2. [`supabase/seed/0002_catalogo_medicamentos.sql`](supabase/seed/0002_catalogo_medicamentos.sql) — catálogo de medicamentos.

> Alternativa al paso 2: en **Table Editor → `medicamentos_catalogo` → Import data from CSV**,
> sube [`supabase/seed/medicamentos_catalogo.csv`](supabase/seed/medicamentos_catalogo.csv).

### 4. Crear el primer usuario
En **Authentication → Users → Add user**, crea un usuario con correo y contraseña
(marca *Auto Confirm User*). Con ese usuario inicias sesión en la app.

> Para permitir el auto-registro desde la pantalla de login, desactiva
> *Confirm email* en **Authentication → Providers → Email**.

### 5. Correr localmente
```bash
npm install
npm run dev
```
Abre http://localhost:3000

### 6. Desplegar en Vercel
1. Sube el repositorio a GitHub.
2. En [vercel.com](https://vercel.com), importa el repo.
3. Agrega las variables de entorno (**Settings → Environment Variables**):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy.

---

## Notas técnicas
- Las fotos de pacientes y las firmas se guardan en **Supabase Storage**
  (buckets `fotos-pacientes` y `firmas`, públicos por defecto).
- La seguridad a nivel de fila (RLS) permite el acceso a cualquier usuario
  **autenticado**. Los visitantes anónimos no tienen acceso.
- El catálogo de medicamentos proviene del dataset abierto
  [`sydmizar/drugs-datasets`](https://github.com/sydmizar/drugs-datasets) (Latinoamérica).
