# Residencia Rosales

Gestión de residentes, medicamentos, cuidados por hora, actividades, personal, visitas y salidas. Next.js 16, React 19 y Supabase.

## Abrir en este equipo

```bash
npm ci
npm run dev -- --hostname 127.0.0.1 --port 3001
```

Abre http://localhost:3001. La configuración local está en `.env.local`, excluida de Git.

`NEXT_PUBLIC_LOCAL_ACCESS=true` permite trabajar sin iniciar sesión **solo en desarrollo y desde localhost**. Las consultas del navegador pasan por un intermediario local; la clave privada permanece en el servidor. En una compilación de producción esta opción queda deshabilitada. Para volver al acceso con cuenta, cambia el valor a `false` y reinicia el servidor.

Mi turno, Administración, Medicamentos e Historial requieren una cuenta de personal autenticada, también en desarrollo, para atribuir cada registro a una persona.

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

## Trabajo por turno

Al iniciar sesión se abre **Mi turno** (`/turno`): una lista común de cuidados y medicamentos para todos los pacientes, organizada por actividad y hora. El personal registra la realización, incidencias y mediciones sin entrar a cada expediente. Se guarda la identidad de la sesión, el momento del cuidado y la hora del registro.

La administradora configura en **Administración** (`/administracion`):

1. Hora de inicio del matutino, vespertino y nocturno. Cada turno termina al comenzar el siguiente; la noche puede cruzar medianoche. La zona de la residencia es `America/Mexico_City`.
2. Turno de cada empleado; «Mixto» permite trabajar en cualquiera de los turnos vigentes.
3. Actividades de cada turno, días de la semana y paciente concreto o todos los pacientes.
4. Pacientes que requieren registro de Cistoflo.

**No hay horarios predeterminados.** Hasta configurar los horarios no se puede abrir un turno ni crear registros clínicos. Los cambios posteriores de horario entran desde el día siguiente o una fecha futura, conservando las jornadas anteriores. El personal entra al turno vigente, debe tenerlo asignado y no puede escribir en turnos pasados o futuros. Estas reglas se aplican en la base de datos además de la interfaz.

En **Agenda** (`/agenda`) se programan cuidados con horas concretas. Las tareas dentro de la ventana del turno aparecen en Mi turno junto con sus actividades habituales y los medicamentos con turnos explícitamente asignados. La agenda sigue mostrando las horas en el eje horizontal, pacientes en filas y la hora actual; las realizaciones se registran desde Mi turno.

## Historial, mediciones y correcciones

**Historial y promedios** (`/historial`) reúne registros anteriores y nuevos. Permite consultar un mes o rango de fechas, paciente, turno, tipo y texto (por ejemplo, «vómito»). Cada expediente también enlaza a su historial.

- Glucosa en mg/dL, contexto de la medición y promedio con número de lecturas; muestra también promedios separados por contexto.
- Cistoflo en ml por vaciado, total del periodo, promedio por vaciado y por día con datos.
- Horas de sueño del turno nocturno y promedio por noche registrada. Un cero explícito cuenta; un dato ausente no se convierte en cero.
- Incidencias, cuidados y medicamentos con responsable y hora.

La administradora puede corregir registros nuevos incluso después de cerrar el turno. Debe indicar un motivo: el original no se borra y se conserva cada versión, su autor y fecha. Solo la última versión vigente cuenta en los promedios; los anulados quedan visibles pero excluidos. Los registros diarios antiguos permanecen como consulta y no pueden modificarse con la interfaz anterior.

## Medicamentos y conteos

**Medicamentos** (`/medicamentos`) reúne los tratamientos y existencias de todos los pacientes, con búsqueda y filtros. La administradora registra un conteo físico con cantidad y motivo; los movimientos conservan el saldo anterior, el nuevo y quién lo registró. Los saldos ya verificados antes de esta actualización se incorporan como saldos existentes, sin afirmar que hubo un nuevo conteo.

Una administración requiere indicación revisada, dosis registrada, existencias verificadas y saldo suficiente. El personal introduce expresamente la cantidad utilizada en la unidad de inventario; nunca se deduce del texto de la dosis. El registro y descuento de existencias se realizan juntos. Repetir una administración manual en el mismo turno exige una observación explícita; las tareas programadas no se duplican.

Las correcciones ajustan el consumo cuando corresponde. Una corrección de una administración anterior a un conteo físico posterior no modifica el saldo que ya fue contado. Si las existencias cambian durante un conteo abierto, se pide actualizar la lista antes de guardarlo.

## Base de datos nueva

Configura las variables de `.env.example` y aplica los archivos SQL de `supabase/migrations` en orden:

1. `0001_init.sql`
2. `0003_roles_y_actividades.sql`
3. `0004_inventario_por_paciente.sql`
4. `0005_medicamentos_con_inventario.sql`
5. `20261027185329_acceso_personal_activo.sql`
6. `20261027185518_registro_salidas_validaciones.sql`
7. `20261027210732_agenda_por_paciente.sql`
8. `20261030195741_turnos_clinicos_auditados.sql`
9. `20261030201312_turnos_revalidar_vigencia_al_guardar.sql`
10. `20261030201745_turnos_indice_por_rutina.sql`

Aplica la secuencia completa antes de cargar datos reales: las migraciones finales restringen el acceso al personal activo y hacen privados los archivos. El catálogo general opcional se carga con `supabase/seed/0002_catalogo_medicamentos.sql`.

La migración de turnos crea jornadas, sesiones, rutinas, eventos y movimientos de inventario. Las tablas solo permiten lectura al personal activo; los cambios pasan por operaciones que validan la identidad, el rol y el turno. Revoca la escritura directa de los registros clínicos anteriores. Aplica las migraciones una sola vez y antes de publicar la versión que las utiliza.

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

Las pruebas cubren importación, usuarios, salidas, agenda, horarios nocturnos, validación de mediciones, búsqueda histórica, correcciones y cálculo de promedios. Las comprobaciones de la base de datos utilizan datos ficticios dentro de transacciones que terminan con rollback: verifican permisos, turnos, autoría, idempotencia, inventario y conservación de originales. No dejan observaciones clínicas de prueba ni horarios inventados.
