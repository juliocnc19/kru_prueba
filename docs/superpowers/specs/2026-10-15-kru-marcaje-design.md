# Kru Marcaje — diseño aprobado

Fecha: 2026-10-15. Fuente funcional: `prueba-tecnica-kru-marcaje.md` y aclaraciones del solicitante.

## Objetivo y límites

Entregar una aplicación SaaS de marcaje utilizable desde móvil y escritorio. Una empresa solicita su alta; el dueño de la plataforma la aprueba y administra las cuentas de RRHH. RRHH administra departamentos y colaboradores de su empresa, consulta el día, corrige marcajes con motivo, calcula semanas y quincenas, visualiza métricas y exporta el CSV exigido. Cada colaborador marca su propia entrada y salida desde un panel web.

El dueño de la plataforma **no** puede leer marcajes, correcciones ni reportes de empresas. RRHH **no** puede acceder a otra empresa. El colaborador solo puede consultar y crear sus propios marcajes. No se incluyen nómina monetaria, turnos programados, pausas, verificación biométrica, aplicación nativa ni integraciones externas.

## Arquitectura

Un monolito modular con Next.js App Router y TypeScript. `src/app` contiene rutas, Server Components, estados de error y Server Actions pequeñas. `src/modules/{identity,companies,departments,employees,attendance,payroll,reports}` concentra por función de negocio los tipos, validaciones, casos de uso y repositorios. `src/db` contiene Drizzle, tablas y migraciones. Dependencias de dominio no importan Next.js ni Drizzle. Los casos de uso reciben interfaces de repositorio y contexto de autorización. Las acciones validan entradas, resuelven la sesión en servidor, llaman casos de uso y devuelven DTO mínimos. Las lecturas para páginas se hacen en Server Components a través de la misma capa de acceso; toda interacción iniciada desde el navegador usa Server Actions. No habrá API pública adicional para este alcance.

Se usa la versión estable más reciente y corregida de Next.js al instalar, con versiones fijadas en `package-lock.json`; Tailwind para estilos, Zustand solo para estado efímero de UI, TanStack Form/Table/Charts para formularios, tablas y métricas. Los datos del servidor, permisos y sesiones no se guardan en Zustand. Las pantallas usan diseño adaptable desde 320 px, controles táctiles amplios, tablas con alternativa compacta en móvil y accesibilidad de teclado y lector de pantalla.

## Modelo de datos

- `users`: identidad, nombre, correo opcional para colaboradores, hash de contraseña, estado y marca de cuenta de plataforma. Solo una cuenta con ese rol puede operar la aprobación.
- `companies`: nombre, identificador público único, estado `pending | active | rejected | suspended`, fecha y responsable de aprobación. El registro crea empresa y cuenta RRHH en una transacción; mientras está pendiente no puede operar.
- `memberships`: relación usuario–empresa, rol `hr | employee`, cédula obligatoria para colaboradores, departamento opcional para RRHH y obligatorio para colaboradores activos, fechas de inicio y baja. Restricciones únicas impiden duplicar cédula dentro de la misma empresa. El identificador de empresa nunca se toma del cliente como autoridad.
- `departments`: relación con empresa, nombre, estado. Al registrar una empresa se crea `General`. Puede renombrarse y pueden añadirse más departamentos.
- `department_policy_versions`: configuración inmutable del departamento: minutos ordinarios por turno (480 por defecto), inicio y fin nocturnos (19:00 y 05:00), umbral semanal de extra (600 minutos), geolocalización requerida, latitud, longitud y radio permitido (`20 | 30 | 40` metros). Activar ubicación exige coordenadas y radio. Cada cambio crea versión nueva; el turno conserva la versión vigente al abrirse.
- `shifts`: colaborador, empresa y departamento al momento de marcar, versión de regla, entrada y salida `timestamptz`, estado, metadatos mínimos de verificación geográfica. Un índice único parcial impide más de un turno abierto por colaborador. Los registros se modifican únicamente mediante casos de uso transaccionales.
- `shift_corrections`: historial inmutable de valor anterior, valor nuevo, actor RRHH, motivo no vacío y fecha. Una corrección no borra su antecedente.
- `sessions`: hash del identificador aleatorio de sesión, usuario, vencimiento, revocación y fecha de creación; permite cerrar sesión y revocar accesos antes de 30 días.

Las claves foráneas, restricciones `CHECK`, índices por empresa/departamento/fecha e índices únicos materializan las invariantes importantes. Las políticas son filas versionadas, no columnas dinámicas ni JSON libre.

## Autenticación y autorización

RRHH y dueño ingresan con correo y contraseña. El colaborador ingresa con código de empresa, cédula y contraseña para permitir cédulas iguales en empresas distintas. La contraseña se almacena con `scrypt` y sal aleatoria. La cookie de sesión es `HttpOnly`, `SameSite=Lax`, `Secure` bajo HTTPS y dura 30 días fijos. El JWT firmado contiene únicamente un identificador opaco de sesión y las marcas temporales necesarias; no contiene rol, nombre, cédula ni empresa. El servidor comprueba firma, vencimiento, hash y revocación en PostgreSQL y carga permisos actuales en cada operación.

`proxy.ts` solo redirige solicitudes claramente anónimas o fuera de sección. La autorización definitiva vive en una capa de acceso a datos: comprueba rol y estado de empresa, añade siempre el predicado de empresa a consultas de RRHH, exige identidad de colaborador para marcajes y comprueba propiedad de cada objeto antes de modificarlo. Las acciones repiten estas comprobaciones aunque la interfaz o la ruta estén protegidas. Un ID ajeno se trata como no encontrado para no revelar existencia. El dueño dispone de acciones separadas para aprobar y gestionar empresas/RRHH y carece de métodos para consultar turnos.

Las secciones protegidas tendrán `loading.tsx` y `error.tsx`; las rutas de detalle tendrán `not-found.tsx`; una ruta `/sin-permiso` mostrará el acceso denegado. Se evita depender de `unauthorized()` y `forbidden()` mientras sigan experimentales.

## Marcaje y geolocalización

La hora de entrada y salida proviene exclusivamente del servidor. Una acción de entrada crea un turno si no hay uno abierto; una salida cierra exactamente el turno abierto. Operaciones concurrentes se resuelven con transacción y restricción única. Un turno pertenece al día local de su entrada aunque termine al día siguiente. RRHH puede corregir entrada/salida con motivo obligatorio; se rechazan rangos con salida anterior a entrada y solapamientos con otros turnos del mismo colaborador.

Si la política requiere ubicación, el navegador solicita una lectura reciente en contexto seguro. La acción recibe latitud, longitud, precisión y marca temporal; valida formato, antigüedad máxima, precisión no mayor que el radio y distancia Haversine al centro configurado. Si la distancia excede 20, 30 o 40 m según el departamento, no marca y muestra un mensaje claro. Si el navegador deniega o no obtiene ubicación precisa, ofrece reintento y RRHH puede corregir después con motivo. Se guardan distancia, precisión y resultado, no coordenadas crudas del colaborador. La geolocalización del navegador puede manipularse; se declara esta limitación en README.

## Cálculo, estado diario y reportes

Todos los límites de fecha se interpretan en `America/Caracas`; los instantes persisten en UTC. Una semana va de lunes a domingo; una quincena va del 1 al 15 o del 16 al último día del mes. Los filtros aceptan un período de esos tipos y, opcionalmente, departamento. Se incluyen turnos cerrados cuya fecha local de entrada cae en el período. Un turno abierto se muestra en el estado diario, pero no aporta horas al CSV hasta cerrarse.

El cálculo segmenta un turno en el umbral de 480 minutos y en cada cambio de franja nocturna local. Suma minutos ordinarios, extra diurnos, extra nocturnos y nocturnos ordinarios. Las horas extra son los últimos minutos del turno; las horas nocturnas ordinarias pertenecen solo al primer bloque ordinario. Solo después de sumar todos los turnos por colaborador se convierten minutos a horas decimales y se redondea a dos decimales. Las alertas usan `> 600` minutos extra por cada semana local; una quincena puede mostrar dos o tres semanas afectadas. Las correcciones vuelven a calcular resultados al consultar, sin totales materializados obsoletos.

La vista diaria distingue `dentro` (turno abierto iniciado hoy), `sin salida` (turno abierto de un día anterior), `sin marcar` (sin turno abierto ni entrada hoy) y `completado` (al menos un turno cerrado hoy). No hay programación de turnos, por lo que `sin marcar` significa ausencia de registro, no incumplimiento laboral. La vista de RRHH muestra resumen, tabla con TanStack Table y gráficos compactos con TanStack Charts por departamento y período. El panel del colaborador muestra estado actual y una acción principal de marcar.

El CSV UTF-8 se genera en servidor y se entrega mediante una Server Action como contenido descargable del lado cliente. Usa `;`, encabezado exacto `cedula;nombre;periodo_desde;periodo_hasta;overtimeDayHours;overtimeNightHours;nightShiftHours`, una fila por colaborador de la empresa que estuvo activo durante el período, fechas `YYYY-MM-DD` y decimales con punto. Los campos textuales se escapan conforme a CSV; se evita que valores introducidos por usuarios se interpreten como fórmulas de hoja de cálculo.

## Entornos y entrega

`docker compose up --build` levanta aplicación y PostgreSQL locales sin configurar variables; un script de entrada espera la base, aplica migraciones y ejecuta semilla idempotente con empresas A/B y usuarios de prueba. Los secretos y credenciales por defecto existen solo en configuración local. Los comandos npm cubren desarrollo, compilación, lint, tipos, tests, cobertura, generación/aplicación de migraciones y semillas. Un volumen conserva los datos locales. La configuración de producción rechaza secretos de desarrollo y exige `DATABASE_URL` y secreto de firma explícitos.

Vercel aloja Next.js; Neon se conecta a través de Vercel Marketplace. Las migraciones de producción se aplican como paso controlado previo al despliegue, no durante cada petición ni durante la compilación. Publicar requiere acceso a un proyecto Vercel, Neon y repositorio remoto proporcionados por el solicitante. README incluirá URL y credenciales de prueba una vez desplegado, diagrama, decisiones y descartes, límites y próximos pasos. También se entregan bitácora de IA con tres correcciones reales y nota de negocio de una página; no se inventarán eventos de IA que no hayan ocurrido.

## Verificación y criterios de aceptación

Jest cubre el motor de cálculo, validaciones, permisos, casos de uso, consultas y componentes interactivos clave. La meta es al menos 90 % de ramas y sentencias en dominio y aplicación; las consultas y acciones críticas tienen pruebas de integración con PostgreSQL. Los dos turnos del enunciado son casos obligatorios. Se prueban además cruces de medianoche y período, redondeo solo al final, umbral semanal exacto y excedido, corrección con y sin motivo, duplicación concurrente, sesión vencida/revocada, aislamiento A/B y denegación de marcajes al dueño de la plataforma. Se verifica compilación, tipos, lint, arranque limpio por Docker y experiencia a anchuras móvil/tablet/escritorio. Las páginas asíncronas de servidor se validan mediante flujos de navegador, ya que Jest no las soporta de forma completa.

## Fuentes técnicas consultadas

- [Next.js: autenticación y autorización](https://nextjs.org/docs/app/guides/authentication)
- [Next.js: mutación con Server Actions](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Next.js: Proxy](https://nextjs.org/docs/app/getting-started/proxy)
- [Vercel: PostgreSQL mediante Marketplace](https://vercel.com/docs/postgres)
- [Drizzle: conexión a Neon](https://orm.drizzle.team/docs/connect-neon)
- [TanStack Charts](https://tanstack.com/charts/latest)
- [MDN: precisión de geolocalización](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy)
