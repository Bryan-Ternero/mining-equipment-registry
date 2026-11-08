# Reto Codea — registro de equipos mineros

Objetivo: construir la aplicación del Reto Codea (registro de equipos + deploy con un solo comando) y verificar cada requisito del PDF del reto.
Rama: `feat/equipment-registry` (commit inicial en `main`). Estrategia de entrega: `ask-on-risk`. Ejecutor de pruebas: Vitest (`npm test`, `npm run test:int`).

## Especificaciones

Citadas textualmente de `reto-fullstack-aplicacion-publicada-con-despliegue-automatiz.pdf` (en español, se conserva la redacción original).

- **S1** CRUD de la app: "Crear, listar, editar y eliminar equipos: código, tipo (camión, excavadora, perforadora) y horómetro (horas de uso)."
- **S2** Aviso de mantenimiento: "Cada tipo tiene un intervalo de mantenimiento en horas. Si un equipo lo alcanza, debe mostrarse como \"Requiere mantenimiento\"."
- **S3** Registro de mantenimiento: "Registrar un mantenimiento deja historial y reinicia el ciclo del equipo."
- **S4** Servicios separados: "Frontend y backend separados, cada uno con su propia URL pública. Pueden estar en un solo repositorio o en dos."
- **S5** API: "Backend con API REST y una ruta /health que responda si el servicio está bien."
- **S6** Base de datos: "Base de datos relacional (PostgreSQL o MySQL)."
- **S7** Secretos: "Sin claves en el repositorio: incluye un .env.example."
- **S8** Comando de deploy: "Un solo comando de terminal, por ejemplo ./deploy.sh o make deploy, que:
  1. Verifique lo necesario antes de empezar (herramientas y variables de entorno).
  2. Construya y publique el frontend y el backend.
  3. Aplique las migraciones de la base de datos.
  4. Compruebe al final que ambos servicios responden, usando /health en el backend.
  5. Termine con un error claro y un código de salida distinto de 0 si algún paso falla.
  Debe poder ejecutarse varias veces sin romper nada."
- **S9** Entrega: "Repositorio o repositorios de GitHub, públicos." / "URL pública del frontend." / "URL pública del backend."
- **S10** README: "README con qué hace, cómo levantarlo en local y cómo desplegarlo." y "Indica en el README qué herramientas usaste".
- **S11** Extras opcionales: "Vuelta a la versión anterior si el despliegue falla." / "Docker o docker-compose." / "GitHub Actions." / "Pruebas automatizadas."
- **S12** Apoyo para el guion del video (lo graba el usuario): "haz un cambio visible, súbelo a GitHub, ejecuta tu comando en la terminal y muestra el cambio ya publicado."

### Supuestos (marcados, no son requisitos del usuario)

- A1 Intervalos: CAMION 250 h, EXCAVADORA 500 h, PERFORADORA 300 h, guardados en una tabla de catálogo de tipos.
- A2 "Reinicia el ciclo" es literal: un servicio guarda `lastServiceHours = hourmeter at service`; el aviso es `hourmeter - lastServiceHours >= interval` (inclusivo, "lo alcanza"). Se deriva, nunca se guarda.
- A3 Un equipo nuevo empieza su ciclo en 0 h, así que una unidad registrada con más horas que su intervalo queda marcada hasta que reciba servicio.
- A4 El horómetro no se puede editar por debajo de la lectura del último servicio (dejaría el ciclo en negativo).
- A5 Eliminar un equipo elimina su historial (en cascada).
- A6 Sin login: el reto no lo pide y bloquearía al evaluador.
- A7 Hosting: Railway (API + PostgreSQL) y Vercel (frontend).

## Tareas

| ID | Especificaciones | Ruta | Estado | Commit / evidencia |
|---|---|---|---|---|
| T1 | S7 | inline | bloqueada (`.env.example`) | `94e12ec`; `.env.example` bloqueado por una regla deny del usuario sobre `.env*`, contenido listo en el scratchpad para que el usuario lo copie |
| T2 | S1-S3, S5, S6 | inline | hecha | `96bb189` `f56f48c` `b349af3` `b07b3b6`; unitarias 5/5, integración 21/21 en PostgreSQL 18; RDD risk+reliability aprobado, corrección resilience+reliability aprobada |
| T3 | S1-S3, S4 | inline | hecha | `db18e94` `751ba16` `a4f345a`; unitarias web 5/5; RDD readability+reliability aprobado; corrección under_budget |
| T4 | S8, S11 (rollback) | inline | hecha | `9c7e1ef` `0a374a7` `d634973` `0fbc0e5` `6abc026`; RDD risk+resilience+reliability aprobado; `0a374a7` rechazado por el usuario |
| T5 | S11 | inline | hecha | `762d8fc`; `docker compose --profile full up` verificado sano (db→migrate→api→web, CORS 201); ShellCheck limpio vía Docker |
| T6 | S4, S9 | inline | parcial | Railway `mining-equipment-registry` (api + Postgres + proxy TCP), Vercel `mining-equipment-web`; deploy verificado. La creación del repositorio público en GitHub quedó bloqueada por el modo auto, necesita aprobación del usuario |
| T7 | S1-S12 | inline | en curso | README escrito; verificación punto por punto en L7 |

Evidencia de la ruta: no hay motivo para el disparador Writer (las unidades son secuenciales y dependientes: la web necesita el contrato de la API, el deploy necesita ambas), así que el padre escribe inline.

## Bitácora

- **L1** (2026-11-07, usuario): inicio del Reto Codea. Primero el plan y después el desarrollo, verificando punto por punto que se cumpla cada requisito del PDF.
- **L2** (2026-11-07, usuario, textual): "recuerda que debes usar gentle ai y odd" — el trabajo sigue el flujo ODD con revisión de gentle-ai.
- **L3** (2026-11-07): T2 construida. Se fijaron versiones mayores estables y probadas de las dependencias (Prisma 6, Vitest 3, TS 5, ESLint 9): la última versión de Prisma es una RC y Prisma 7 cambia la configuración de la conexión. El catálogo de tipos lo inserta la migración inicial (sin seed aparte en el deploy). Prisma bloquea `migrate reset` para agentes de IA, así que la preparación de integración usa el no destructivo `migrate deploy` y cada prueba elimina sus propias filas. Una prueba detectó un error doble con un código vacío; corregido con `abort: true`. Espejo de Engram pendiente (el modo auto no pudo revisar la llamada).
- **L4** (2026-11-07, usuario, textual): "Ya está docker abierto,todo lo que sea engram se guardará al final del proyecto" — espejo de Engram aplazado al cierre del proyecto por decisión del usuario.
- **L5** (2026-11-07, usuario): estrategia de cadena de entrega "stacked-to-main". Partes: commit inicial en `main`; `feat/api` (dominio+esquema, luego REST+pruebas de integración); `feat/web` apilada sobre `feat/api`; luego deploy, CI/docker, documentación. Cada parte se convierte en un PR a `main` una vez que exista el repositorio de GitHub; el merge sigue siendo decisión del usuario.
- **L6** (2026-11-08): evidencia del deploy. Las ejecuciones 1-3 fallaron con salida 5 antes de publicar nada (EPERM de Windows: los servidores de desarrollo locales retenían `node_modules`; pista agregada en `6abc026`). Ejecución 4: salida 0, migración `20261108000000_init` aplicada, `/health` reporta `0fbc0e5`. Ejecución 5 (mismo commit): salida 0, "No pending migrations to apply", datos conservados. Ejecución 6 con `DEPLOY_SIMULATE_FAILURE=verify`: salida 9, API y web restauradas al deployment anterior y verificadas sanas de nuevo. Railway no expone `DATABASE_PUBLIC_URL`: URL construida a partir de las partes del proxy TCP (`d634973`). Las URL de preview de Vercel están detrás de Deployment Protection: la comprobación del candidato se degrada a una advertencia y la URL pública se verifica tras la promoción.
- **L7** (2026-11-08) punto por punto frente al PDF: S1 CRUD ✅ (integración + curl en producción); S2 aviso inclusivo por tipo ✅; S3 historial + reinicio del ciclo ✅; S4 URL públicas separadas ✅ (Vercel + Railway); S5 REST + /health con comprobación de la base de datos ✅; S6 PostgreSQL ✅; S7 sin secretos en commits ✅, `.env.example` ⏳ (bloqueado); S8.1-5 ✅ (códigos de salida 2-10 observados: 2, 5, 9, 0); idempotente ✅; S9 repositorio ⏳ (necesita aprobación del usuario), URL ✅; S10 README ✅; S11 rollback ✅, docker-compose ✅, Actions ✅ (primera ejecución pendiente del push), pruebas ✅; S12 video: lo graba el usuario.
- **L8** (2026-11-08): endurecimiento de T5. La revisión de `0a374a7..6efeb52` fue aprobada; su hallazgo consultivo sobre el target `migrate` de compose era un bug real (las dependencias de desarrollo podadas eliminaban la CLI de Prisma), corregido en `d578c44` y verificado sobre un volumen nuevo. La revisión de `d578c44` abrió una corrección (`R3-exit-code-assertion-neutralized`, determinista): corrección acotada de 1 línea `5d5df4f`, validada y aprobada. El mismo patrón preexistente se corrigió en `30b542e`, aprobado. Pendiente del usuario: crear el repositorio público de GitHub y hacer push (el modo auto lo bloqueó), mover `env.example.txt` a `.env.example` (regla deny sobre `.env*`), abrir/hacer merge de los PR apilados, grabar el video.
- Seguimientos (hallazgos consultivos de revisión, no bloqueantes): manejo del timeout de espera de bloqueo, prueba del mapeo de conflictos CHECK, protección de Vercel en previews, reintentos de reinicio en Railway.
