# Login basado en roles y nueva identidad visual

Objetivo: agregar un login funcional basado en roles (dos roles), rediseñar todo el sistema según la referencia "Bootstrap Table Screen" de Webpixels y permitir que cada mantenimiento registre su fecha, hora y comentarios.
Rama: `feat/auth` (apilada sobre `feat/docs`). Estrategia de entrega: `ask-on-risk`, estrategia de cadena `stacked-to-main` (reutilizada de mining-equipment-registry L7). Ejecutor de pruebas: Vitest.

## Especificaciones

Solicitud del usuario citada textualmente (2026-11-08):

- **S1** Login: "necesito un login" … "el login debe funcional basado en roles con 2 roles".
- **S2** Diseño del login: "tener un diseño 60/40, 60% imagen de referencia de lo que trata mas el nombre del proyecto,40% login".
- **S3** Identidad visual: "un cambio completo de identidad visual,guiate del siguiente diseño para todo el sistema (https://dribbble.com/shots/21602075-Bootstrap-Table-Screen-Webpixels)".
- **S4** Registro de mantenimiento: "cada que se haga un mantenimiente se guarde la fecha y hora en que se realizo y los comentarios".
- **S5** Roles (propuesta aceptada por el usuario, "me sirve"):

  | | Supervisor | Operador |
  |---|---|---|
  | Ver equipos e historial | ✅ | ✅ |
  | Registrar mantenimiento | ✅ | ✅ |
  | Actualizar horómetro | ✅ | ✅ |
  | Crear, cambiar tipo y eliminar equipos | ✅ | ❌ |

### Supuestos (comunicados al usuario, no objetados)

- A1 Nombre del proyecto mostrado en el login: "Registro de equipos mineros".
- A2 Dos cuentas fijas (una por rol) definidas por variables de entorno; sin pantalla de gestión de usuarios. Las contraseñas se guardan solo como hashes scrypt.
- A3 Imagen del login: `login-haul-truck.jpg`, fotografía de un camión minero de acarreo en una faena a cielo abierto.
- A4 La página de Dribbble no se puede descargar (respuesta vacía); el estilo sigue las convenciones públicas del CSS de Webpixels: Inter, primario índigo, fondo gray-50, tarjetas blancas con sombras suaves, encabezados de tabla en mayúsculas y atenuados, badges con punto.
- A5 Editar el código de un equipo se considera exclusivo del supervisor (identidad del equipo), igual que su tipo.
- A6 S4 ya lo guarda la API (`performedAt`, `notes`); lo que falta es la interfaz (entrada de fecha/hora) y quién lo realizó (`performedBy`, columna nueva).
- A7 `/health` sigue siendo público (el deploy y el evaluador lo necesitan).

## Tareas

| ID | Especificaciones | Ruta | Estado | Commit / evidencia |
|---|---|---|---|---|
| T1 | S1, S5 | inline | hecha | `2acf031` + corrección `0f5667b`; RDD risk/resilience/reliability: corrección (evasión del guard vía `/%61pi/`, X-Forwarded-For falsificado) reproducida en RED, corregida, validada, aprobada |
| T2 | S4 | inline | hecha | `8aa1c85`; migración `20261108120000_maintenance_performed_by` (columna nullable); under_budget, revisada junto con la parte de T3 |
| T3 | S1-S5 | inline | hecha | `6fcef95` + `7b5571e`; unitarias web 12/12; capturas con Edge headless (login 60/40, paneles por rol, diálogo, teléfono); bug de recarga con sesión detectado por las capturas y corregido; RDD aprobado |
| T4 | S1 | inline | hecha | `01fe7fb`; salida 2 del preflight observada con AUTH_* ausentes; deploy con salida 0, `/health` 01fe7fb, anónimo 401, ruta codificada 401, creación por operador 403; RDD rechazado por el usuario |

Evidencia de la ruta: una funcionalidad secuencial (la web depende del contrato de autenticación), sin motivo para el disparador Writer; el padre escribe inline.

## Bitácora

- **L1** (2026-11-08, usuario, textual): "necesito un login y un cambio completo de identidad visual,guiate del siguiente diseño para todo el sistema (https://dribbble.com/shots/21602075-Bootstrap-Table-Screen-Webpixels),el login debe funcional basado en roles con 2 roles y tener un diseño 60/40, 60% imagen de referencia de lo que trata mas el nombre del proyecto,40% login,ademas necesito que cada que se haga un mantenimiente se guarde la fecha y hora en que se realizo y los comentarios,si necesitas algo mas de informacion dimelo."
- **L2** (2026-11-08, usuario, textual): "me sirve" — acepta la tabla de roles (S5) y los supuestos comunicados.
- **L3** (2026-11-08): el separador del hash es ":" porque dotenv expande "$NAME" en los valores del .env. trustProxy limitado al salto de la plataforma (forma de función; los tipos de Fastify 5 rechazan un número). La comprobación del login se omite al verificar un rollback, que puede restaurar una versión anterior al login. Cuentas de producción: usuarios `supervisor` / `operador`, solo hashes scrypt en Railway.
- **L4** (2026-11-08, usuario, textual salvo el secreto omitido): "responde en español,recuerda que debes usar gentle ia,ademas debes cambiar las contraseñas modificar ambas por [contraseña omitida]". Ambas contraseñas de producción se reemplazaron por una única contraseña elegida por el usuario (decisión del usuario para la demo de evaluación; se le advirtió que es más corta que el mínimo de 8 caracteres que exige `auth:hash`). La contraseña en sí nunca se escribe en el repositorio. Hashes generados con el propio `hashPassword` de la API, verificados contra los valores guardados en Railway, aplicados con `./deploy.sh`. Cambio solo de configuración: sin commit de código, por lo que no hay candidato para revisión de gentle-ai. Evidencia del deploy en T4. Seguimientos (consultivos): token en localStorage (exposición a XSS, aceptada para una SPA estática en otro origen), carga de terceros de Google Fonts, números de intervalo fijos en el código de la pantalla previa al login.
- **L5** (2026-11-08, el usuario eligió la opción A): antes del primer push, se reescribió el historial de `feat/auth` (`git filter-branch --tree-filter`, 9 commits) para eliminar las credenciales de login de la demo local que `2acf031` había puesto en `docker-compose.yml` y en el README. Verificado: ninguna rama las contiene y el árbol final es idéntico byte a byte a la punta anterior a la reescritura. Los hashes de commit de este documento se actualizaron a los reescritos. Producción aún reporta la versión anterior a la reescritura `e61a33f` (mismo árbol que `d25be5e`); ese hash ya no existe, así que el próximo deploy no tiene destino de rollback para la API (advierte y continúa) y el siguiente funciona con normalidad.
- **L6** (2026-11-08, usuario, textual): "haz todo tu" — entrega a `main`. Los PR #1 (api), #7 (web; reemplaza a #2, que GitHub cerró cuando se eliminó su rama base), #3 (deploy), #4 (ci), #5 (docs), #6 (auth) se integraron en orden con merge commits. GitHub registró el workflow solo cuando `ci.yml` llegó a `main`; el primer CI en `main` y en #5/#6 pasó (API, Web, deploy.sh). El primer deploy desde `main` se detuvo con salida 4 antes de publicar: `vercel link` volvió a añadir reglas al `apps/web/.gitignore` versionado después de que git lo normalizara a LF. Corregido en #8 (archivo dejado de versionar, ignorado desde la raíz). Deploy final desde `main`: salida 0, `/health` reporta `f2f8f60` (un ancestro de `main`), ambas cuentas inician sesión, las llamadas anónimas reciben 401.
