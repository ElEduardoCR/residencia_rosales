# Residencia Rosales

Gestión de residentes, medicamentos, cuidados por hora, actividades, personal, visitas y salidas. Next.js 16, React 19 y Supabase.

## Abrir en este equipo

```bash
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Abre http://localhost:3001. La configuración local está en `.env.local`, excluida de Git.

`NEXT_PUBLIC_LOCAL_ACCESS=true` permite trabajar sin iniciar sesión **solo en desarrollo y desde localhost**. Las consultas del navegador pasan por un intermediario local; la clave privada permanece en el servidor. En una compilación de producción esta opción queda deshabilitada. Para volver al acceso con cuenta, cambia el valor a `false` y reinicia el servidor.

La agenda requiere una cuenta de personal autenticada, también en desarrollo, para atribuir cada realización a una persona.

## Variables de entorno

Los nombres y su plantilla están en `.env.example`. Configura los valores en `.env.local` y en el proyecto de Vercel para cada entorno utilizado; nunca los incorpores a Git. Después de cambiarlos en Vercel, vuelve a publicar para aplicarlos.

| Variables | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión pública a Supabase y sesiones de usuario. |
| `SUPABASE_SERVICE_ROLE_KEY` | Operaciones autorizadas del servidor; nunca se envía al navegador. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Identificación del servicio de notificaciones Web Push. |
| `CRON_SECRET` | Autorización del proceso de recordatorios. |
| `NEXT_PUBLIC_LOCAL_ACCESS` | Acceso temporal de desarrollo, deshabilitado para usar cuentas individuales. |
| `SUPABASE_DB_URL` | Solo para herramientas locales de migración; no es necesaria para ejecutar la aplicación. |

## Funcionalidades

- Diseño morado, tipografía del sistema y navegación translúcida, con adaptación móvil.
- Botón de modo claro/oscuro en el menú y en el inicio de sesión. Recuerda la elección en ese navegador; antes de elegir, sigue la apariencia del sistema.
- Agenda de cuidados en `/agenda`: horas en el eje horizontal, pacientes en filas, indicador de la hora actual y registro individual de cumplimiento.
- Expediente de cada residente, contactos, alergias, cuidados e indicaciones documentales.
- Medicamentos con inventario, fuente original y revisión explícita antes de programar administraciones.
- Personal con buscador, expediente y turnos cuando estén documentados.
- Registro de salida independiente en `/salidas`: motivo, destino, estado físico, movilidad, lesiones, pertenencias al salir/regresar, cuatro firmas y versión imprimible.
- Visitas en `/visitas`, menú semanal y actividades.

## Agenda por hora y registro diario

En `/agenda`, la administración programa medicamentos, alimentación, terapia física, baño e higiene, visitas u otros cuidados. Cada tarea tiene hora, fecha y paciente; puede ser puntual o repetirse en los días elegidos. Los cuidados generales pueden asignarse a varios pacientes, con un registro independiente para cada uno. Los medicamentos siempre se eligen del expediente de un paciente concreto.

Los horarios deben introducirse explícitamente. La agenda no deduce horas de los documentos, del menú ni de los turnos. Una indicación de medicamento pendiente de revisión no se puede programar ni marcar como administrada. La hora actual y los estados se actualizan cada 30 segundos, usando la zona horaria de la residencia (`America/Mexico_City`); también hay selección de fecha y filtros por paciente y tipo de cuidado.

El personal confirma cada cuidado realizado con su propia sesión. Se guardan su identidad, la hora del registro y las observaciones opcionales; no se permiten realizaciones de días futuros. Si dos personas registran la misma tarea del mismo día, se conserva la primera realización. La administración puede retirar una programación; sus registros históricos permanecen disponibles, también cuando un paciente queda inactivo.

El **Registro diario** de cada expediente conserva los controles por turno y los registros de alimentación. Las administraciones confirmadas en la agenda aparecen allí con su responsable y hora. Un medicamento programado por hora se registra desde la agenda y sus controles por turno quedan deshabilitados para esa fecha, para evitar duplicarlo entre ambas vistas. El apartado de actividades generales continúa disponible por separado.

## Base de datos nueva

Configura las variables de `.env.example` y aplica los archivos SQL de `supabase/migrations` en orden:

1. `0001_init.sql`
2. `0003_roles_y_actividades.sql`
3. `0004_inventario_por_paciente.sql`
4. `0005_medicamentos_con_inventario.sql`
5. `20261027185329_acceso_personal_activo.sql`
6. `20261027185518_registro_salidas_validaciones.sql`
7. `20261027210732_agenda_por_paciente.sql`

Aplica la secuencia completa antes de cargar datos reales: las migraciones finales restringen el acceso al personal activo y hacen privados los archivos. El catálogo general opcional se carga con `supabase/seed/0002_catalogo_medicamentos.sql`.

La migración de agenda ya está aplicada en la base de datos conectada. Crea las programaciones y realizaciones por paciente, protege su autoría mediante la sesión y vincula las administraciones de medicamentos al historial del expediente en la misma transacción. Para una instalación nueva, aplícala después de las seis migraciones anteriores; no vuelvas a ejecutarla sobre tablas ya creadas.

El inicio de sesión utiliza el primer nombre del empleado y su contraseña. No distingue mayúsculas ni tildes; los nombres completos y correos no se usan como usuario. Si dos integrantes activos tienen el mismo primer nombre, el acceso se bloquea para no entrar a una cuenta equivocada.

Cada cuenta de Supabase Auth debe estar vinculada al registro de personal mediante `user_id`. El inicio de sesión resuelve esa relación solo en el servidor y verifica la contraseña con Supabase Auth; nunca devuelve el directorio de personal al formulario público. El correo de contacto del expediente es opcional e independiente del acceso. Las cuentas sin correo pueden usar un identificador interno reservado en Auth, sin enviar correos ni exponerlo en la interfaz. Crear un integrante no crea automáticamente una contraseña.

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

Las pruebas cubren conciliación e idempotencia, fechas y estados de salida, medicamentos pendientes, usuarios, límites del acceso local y reglas de fechas, recurrencia y estados de la agenda. La verificación de base de datos de la agenda comprueba roles, identidad del responsable, fechas futuras, indicaciones pendientes, duplicados e integridad del historial mediante una transacción de prueba que termina con rollback.
