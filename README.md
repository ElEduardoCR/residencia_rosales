# Residencia Rosales

Gestión de residentes, medicamentos, actividades, personal, visitas y salidas. Next.js 16, React 19 y Supabase.

## Abrir en este equipo

```bash
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Abre http://localhost:3001. La configuración local está en `.env.local`, excluida de Git.

`NEXT_PUBLIC_LOCAL_ACCESS=true` permite trabajar sin iniciar sesión **solo en desarrollo y desde localhost**. Las consultas del navegador pasan por un intermediario local; la clave privada permanece en el servidor. En una compilación de producción esta opción queda deshabilitada. Para volver al acceso con cuenta, cambia el valor a `false` y reinicia el servidor.

## Funcionalidades

- Diseño morado, tipografía del sistema y navegación translúcida; modo oscuro y adaptación móvil.
- Expediente de cada residente, contactos, alergias, cuidados e indicaciones documentales.
- Medicamentos con inventario, fuente original y revisión explícita antes de programar administraciones.
- Personal con buscador, expediente y turnos cuando estén documentados.
- Registro de salida independiente en `/salidas`: motivo, destino, estado físico, movilidad, lesiones, pertenencias al salir/regresar, cuatro firmas y versión imprimible.
- Visitas en `/visitas`, menú semanal y actividades.

## Base de datos nueva

Configura las variables de `.env.example` y aplica los archivos SQL de `supabase/migrations` en orden:

1. `0001_init.sql`
2. `0003_roles_y_actividades.sql`
3. `0004_inventario_por_paciente.sql`
4. `0005_medicamentos_con_inventario.sql`
5. `20261027185329_acceso_personal_activo.sql`
6. `20261027185518_registro_salidas_validaciones.sql`

Aplica la secuencia completa antes de cargar datos reales: las migraciones finales restringen el acceso al personal activo y hacen privados los archivos. El catálogo general opcional se carga con `supabase/seed/0002_catalogo_medicamentos.sql`.

En producción, crea el registro de personal con correo y rol adecuado desde una sesión administrativa y vincúlalo a la cuenta de Supabase Auth mediante `user_id`. Para la primera cuenta, usa el panel de Supabase: crea primero un registro de personal activo con correo y rol `admin`, y después el usuario Auth con ese mismo correo. El disparador enlaza los correos autorizados; registrarse por sí solo no concede acceso.

El portal familiar anterior no verificaba el vínculo con el residente. Sus rutas requieren ahora acceso del personal. Fotos y firmas se sirven mediante `/api/archivos`, que verifica el acceso en cada solicitud.

## Importación documental privada

El archivo local `.private-import/normalized-records.json` contiene la transcripción conciliada de los documentos. No se incorpora al repositorio ni al sitio público. La importación mantiene identificadores estables y conserva registros ya existentes.

```bash
npm run import:records                         # Validación local, sin escritura
npm run import:records -- --check-remote        # Comprobar coincidencias existentes
npm run import:records -- --apply               # Insertar y verificar
```

La actualización de octubre tiene prioridad sobre las fichas anteriores para el mismo paciente. Se conserva el texto original y las discrepancias. Las unidades ambiguas no se corrigen ni se deducen horarios. Las indicaciones importadas quedan pendientes de revisión, sin turnos de administración. Las existencias desconocidas se muestran sin verificar; deben registrarse mediante un conteo real.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Las pruebas cubren conciliación e idempotencia, fechas y estados de salida, medicamentos pendientes y límites del acceso local.
