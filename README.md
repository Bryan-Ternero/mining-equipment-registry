# Registro de equipos mineros

**Autor:** Bryan Ternero · [github.com/Bryan-Ternero](https://github.com/Bryan-Ternero)

Aplicación web para registrar los equipos de una faena (camiones, excavadoras y perforadoras),
llevar su horómetro y saber cuándo cada uno **requiere mantenimiento**. Registrar un servicio
deja historial y reinicia el ciclo del equipo.

Frontend y backend se publican por separado y se despliegan con **un solo comando**:
`./deploy.sh`.

| | URL |
|---|---|
| Aplicación (frontend) | <https://mining-equipment-web.vercel.app> |
| API (backend) | <https://api-production-cb462.up.railway.app> |
| Health | <https://api-production-cb462.up.railway.app/health> |

---

## Qué se realizó

| Entrega | Resumen |
|---|---|
| **Aplicación** | Registro de equipos con alta, edición, baja y listado; aviso de "Requiere mantenimiento" por tipo; registro de mantenimientos con fecha y hora, comentarios y autor, que reinicia el ciclo del equipo. |
| **Login por roles** | Supervisor y operador, aplicado en la API (cada ruta) y en la interfaz (cada botón). Pantalla de ingreso 60/40 con la imagen de la operación. |
| **Identidad visual** | Diseño basado en el estilo Webpixels: barra lateral, tarjetas de resumen, tabla con filtros y búsqueda, estados con color. Funciona en escritorio y celular. |
| **API REST** | Fastify sobre PostgreSQL, con `/health` que comprueba la base y reporta la versión desplegada. |
| **Despliegue automatizado** | `./deploy.sh`: verifica, construye, migra, publica, comprueba y vuelve atrás solo si algo falla. |
| **Calidad** | Pruebas unitarias y de integración contra PostgreSQL real, CI en GitHub Actions, stack local con Docker. |

## Cómo se hizo

### Arquitectura

```
 Navegador ──► Frontend (React + Vite) ──────► API REST (Fastify) ──► PostgreSQL
               Vercel, sitio estático          Railway                 Railway
                                                 ▲
 ./deploy.sh ── build local ── migraciones ──────┘── publica API y web ── verifica /health
```

- **Monorepo** con `apps/api` y `apps/web`: cada uno se construye y publica por separado, con su
  propia URL, como pide el reto.
- **La API concentra las reglas.** El frontend solo muestra lo que la API calcula, así ninguna regla
  queda duplicada.

### Decisiones de diseño

| Decisión | Por qué |
|---|---|
| **El estado "Requiere mantenimiento" se calcula, no se guarda** | Se deriva del horómetro, la lectura del último servicio y el intervalo del tipo. Al no estar guardado, nunca puede quedar desactualizado. |
| **Registrar un mantenimiento fija el inicio del ciclo en la lectura actual** | Es el "reinicia el ciclo" del enunciado: el próximo aviso llega a *lectura + intervalo*. |
| **Los tipos y sus intervalos viven en una tabla** (`equipment_types`) | Cambiar un intervalo o sumar un tipo es una migración, no un cambio de lógica. |
| **Reglas protegidas también en la base** (`CHECK`, claves foráneas, bloqueo de fila) | Aunque dos personas registren un servicio al mismo tiempo, el horómetro nunca queda por debajo del historial. |
| **Cuentas de login en variables de entorno**, con contraseñas solo como hash scrypt | El reto pide dos roles fijos: no hace falta una tabla de usuarios, y los secretos viven donde viven los secretos (Railway), nunca en el repositorio. |
| **Migraciones solo hacia adelante** | Por eso el despliegue se niega a publicar una versión anterior a la que corre en producción. |
| **El frontend tolera tipos que no conoce** y tiene una pantalla de recuperación | Si la base va por delante del código, la interfaz muestra un ícono genérico en lugar de quedarse en blanco. |

### Proceso de trabajo

1. **Especificación primero.** Los requisitos del PDF se citaron textualmente en
   [`odd/tasks/`](odd/tasks/), junto con las suposiciones y una bitácora de cada decisión.
2. **Pruebas antes del código.** Cada regla se escribió primero como una prueba que fallaba y
   después se implementó.
3. **Cambios chicos y revisados.** Cada parte entró a `main` por un pull request con CI en verde;
   los cambios de riesgo pasaron además por una revisión automática (gentle-ai) y sus hallazgos
   se corrigieron en commits propios.
4. **Verificación real.** Cada despliegue se comprobó contra producción: `/health`, inicio de sesión
   por rol y capturas en escritorio y celular.

## Cumplimiento del reto

### La aplicación

| Requisito del reto | Estado | Dónde |
|---|:---:|---|
| Crear, listar, editar y eliminar equipos: código, tipo y horómetro | ✅ | `apps/api/src/routes/equipment.ts`, pruebas en `apps/api/tests/integration/equipment.spec.ts` |
| Cada tipo tiene un intervalo; al alcanzarlo se muestra "Requiere mantenimiento" | ✅ | `apps/api/src/domain/maintenance.ts` y sus pruebas unitarias |
| Registrar un mantenimiento deja historial y reinicia el ciclo | ✅ | `apps/api/src/services/equipment-service.ts`, pruebas en `maintenance.spec.ts` |

### Requisitos técnicos

| Requisito del reto | Estado | Dónde |
|---|:---:|---|
| Frontend y backend separados, cada uno con su URL pública | ✅ | Vercel y Railway (ver URLs arriba) |
| API REST con una ruta `/health` | ✅ | `apps/api/src/routes/health.ts`: `200` si la base responde, `503` si no |
| Base de datos relacional | ✅ | PostgreSQL 18 con migraciones versionadas en `apps/api/prisma/migrations` |
| Sin claves en el repositorio, con `.env.example` | ✅ | [`.env.example`](.env.example); ningún `.env` ni credencial en el historial |

### La automatización (un solo comando)

| Requisito del reto | Estado | Cómo lo hace `./deploy.sh` |
|---|:---:|---|
| 1. Verifica herramientas y variables antes de empezar | ✅ | Paso 1: lista todo lo que falta de una vez (código `2`) |
| 2. Construye y publica frontend y backend | ✅ | Pasos 4 y 6: build local y publicación en Railway y Vercel |
| 3. Aplica las migraciones | ✅ | Paso 5: `prisma migrate deploy`, solo las pendientes |
| 4. Comprueba al final ambos servicios con `/health` | ✅ | Paso 7: `/health`, versión publicada, login exigido, CORS y sitio |
| 5. Error claro y código distinto de 0 si algo falla | ✅ | Mensaje `FAILED` y un código por etapa (`2` a `10`) |
| Puede ejecutarse varias veces sin romper nada | ✅ | Migraciones idempotentes; volver a publicar reemplaza el deployment |

### Entrega

| Requisito del reto | Estado |
|---|:---:|
| Repositorio público en GitHub | ✅ |
| URL pública del frontend y del backend | ✅ |
| README con qué hace, cómo levantarlo en local y cómo desplegarlo | ✅ |
| README con las herramientas de IA usadas | ✅ |

### Puntos opcionales ("suma puntos")

| Opcional | Estado | Dónde |
|---|:---:|---|
| Vuelta a la versión anterior si el despliegue falla | ✅ | [Rollback automático](#rollback-automático), ensayado en producción |
| Docker o docker-compose | ✅ | [`docker-compose.yml`](docker-compose.yml): base, migraciones, API y web |
| GitHub Actions | ✅ | [`ci.yml`](.github/workflows/ci.yml): lint, tipos, pruebas, build y fallas de `deploy.sh` |
| Pruebas automatizadas | ✅ | API (unitarias e integración con PostgreSQL) y frontend |

---

## Inicio rápido

| Quiero… | Comando |
|---|---|
| Levantar todo en local con Docker | `docker compose --profile full up --build` → <http://localhost:8080> |
| Desarrollar en local | ver [Desarrollo local](#desarrollo-local) |
| Desplegar a producción | `./deploy.sh` |
| Correr las pruebas | `npm test` y `npm run test:int` |

---

## Qué hace

| Función | Regla |
|---|---|
| **Equipos** | Crear, listar, editar y eliminar. Cada equipo tiene código único (`CAM-001`), tipo y horómetro (horas de uso). |
| **Intervalo por tipo** | Camión cada **250 h**, excavadora cada **500 h**, perforadora cada **300 h** y cargador frontal cada **400 h** (agregado de forma temporal para probar el despliegue de una migración nueva). Los intervalos viven en la tabla `equipment_types`. |
| **Requiere mantenimiento** | Un equipo lo muestra cuando las horas usadas desde su último servicio **alcanzan** el intervalo de su tipo (`horas desde el servicio >= intervalo`). El estado se calcula en cada consulta, nunca se guarda, así que no puede quedar desactualizado. |
| **Registrar mantenimiento** | Guarda en el historial la **fecha y hora** en que se realizó, los **comentarios**, la lectura del horómetro y **quién lo registró**, y **reinicia el ciclo**: la lectura del servicio pasa a ser el inicio del ciclo siguiente. |
| **Login por roles** | Pantalla 60/40 (foto de la operación y nombre del proyecto / formulario). Dos cuentas, una por rol. Sin sesión, la API solo responde `/health`. |

### Roles

| Acción | Supervisor | Operador |
|---|:---:|:---:|
| Ver equipos e historial | ✅ | ✅ |
| Registrar mantenimiento | ✅ | ✅ |
| Actualizar horómetro | ✅ | ✅ |
| Crear, cambiar código o tipo, y eliminar equipos | ✅ | ❌ (`403`) |

La API aplica estas reglas en cada ruta; la interfaz además oculta lo que el rol no puede hacer.
Las contraseñas solo existen como hash scrypt en variables de entorno, la sesión es un token
firmado (HMAC) que dura 12 horas, y 5 intentos fallidos desde una misma dirección bloquean el
login por 15 minutos.

> Las credenciales de la demo publicada se entregan junto con los enlaces, no en el repositorio.

Reglas de integridad (validadas por la API y por la base de datos):

- El horómetro no puede quedar por debajo de la lectura del último mantenimiento.
- Un servicio no puede registrarse con una lectura menor al horómetro actual, con fecha futura
  ni con fecha anterior al último servicio.
- Un equipo nuevo empieza su ciclo en 0 h: si se registra con más horas que su intervalo,
  aparece como "Requiere mantenimiento" hasta su primer servicio.
- Eliminar un equipo elimina también su historial.

### API REST

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/health` | Pública. `200` con `{ status, db, version }`; `503` si la base no responde. `version` es el commit desplegado. |
| `POST` | `/api/auth/login` | Pública. `{ username, password }` → `{ token, expiresAt, user: { username, role } }`; `401` si no coinciden, `429` tras 5 fallos. |
| `GET` | `/api/auth/me` | Usuario de la sesión. |
| `GET` | `/api/equipment-types` | Tipos con su intervalo. |
| `GET` | `/api/equipment` | Equipos con su estado de mantenimiento calculado. |
| `POST` | `/api/equipment` | Crea un equipo → `201`. |
| `GET` | `/api/equipment/:id` | Detalle → `404` si no existe. |
| `PATCH` | `/api/equipment/:id` | Edita código, tipo u horómetro. |
| `DELETE` | `/api/equipment/:id` | Elimina el equipo y su historial → `204`. |
| `GET` | `/api/equipment/:id/maintenances` | Historial, el más reciente primero. |
| `POST` | `/api/equipment/:id/maintenances` | `{ performedAt?, notes?, hourmeter? }`: registra el servicio con su fecha y hora, comentarios y autor, y reinicia el ciclo → `201`. |

Todas las rutas `/api` salvo el login exigen `Authorization: Bearer <token>`. Todos los errores
tienen la misma forma: `{ "error": { "code", "message", "details" } }` (`VALIDATION_ERROR` 400,
`UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `TOO_MANY_REQUESTS` 429).

---

## Stack

| Capa | Tecnología | Hosting |
|---|---|---|
| Frontend | React 19 + Vite (sitio estático) | Vercel |
| Backend | Node 24 + Fastify 5 (API REST) | Railway |
| Base de datos | PostgreSQL 18 + Prisma 6 (migraciones versionadas) | Railway |
| Pruebas | Vitest: unitarias e integración contra PostgreSQL real | GitHub Actions |

```
apps/api/      API: dominio, servicios, rutas, migraciones y pruebas
apps/web/      Frontend
deploy.sh      Despliegue de un solo comando
scripts/       Verificación posterior al despliegue
odd/           Plan, especificación y bitácora del desarrollo
```

---

## Desarrollo local

Requisitos: Node 20 o superior y Docker.

```bash
cp .env.example .env                 # luego complete las cuentas AUTH_* (ver Cuentas de login)
docker compose up -d db              # PostgreSQL en localhost:5433
docker compose exec db psql -U postgres -c "CREATE DATABASE equipment_test"   # solo para las pruebas

npm --prefix apps/api ci
npm run db:migrate                   # crea las tablas y los tipos de equipo
npm run dev:api                      # http://localhost:3001

npm --prefix apps/web ci
npm run dev:web                      # http://localhost:5173
```

> PostgreSQL usa el puerto **5433** para no chocar con una instalación local en el 5432.

### Cuentas de login

El repositorio no trae ninguna cuenta: la API y `docker compose` no arrancan hasta que `.env`
tenga las variables `AUTH_*`, y el error indica cuáles faltan. Para cada rol elija una
contraseña y genere su hash:

```bash
npm --prefix apps/api ci
AUTH_PASSWORD='contraseña-del-supervisor' npm --prefix apps/api run auth:hash
AUTH_PASSWORD='contraseña-del-operador' npm --prefix apps/api run auth:hash
# cada corrida imprime PASSWORD_HASH=scrypt:... y un AUTH_TOKEN_SECRET=... nuevo
```

Copie en `.env` el `PASSWORD_HASH` de cada cuenta (`AUTH_SUPERVISOR_PASSWORD_HASH`,
`AUTH_OPERATOR_PASSWORD_HASH`) y uno de los `AUTH_TOKEN_SECRET`. Los usuarios por defecto son
`supervisor` y `operador`.

La contraseña se pasa por variable de entorno y no como argumento, para que no quede en el
historial de la terminal. En producción las mismas variables viven en Railway (ver
[Configuración desde cero](#configuración-desde-cero)).

### Todo con Docker

```bash
docker compose --profile full up --build
```

Levanta en orden PostgreSQL → migraciones → API (<http://localhost:8081>) → frontend
(<http://localhost:8080>). Cada servicio espera a que el anterior esté sano.

### Pruebas y calidad

| Comando | Qué verifica |
|---|---|
| `npm test` | Reglas del dominio y helpers del frontend. |
| `npm run test:int` | La API completa contra PostgreSQL real (usa `TEST_DATABASE_URL`). |
| `npm run lint` | ESLint en API y frontend. |
| `npm run typecheck` | TypeScript en API y frontend. |

GitHub Actions ([`ci.yml`](.github/workflows/ci.yml)) corre todo lo anterior en cada push y PR,
aplica las migraciones sobre una base limpia, pasa ShellCheck sobre `deploy.sh` y comprueba que
el script falle con código `2` cuando faltan variables o herramientas.

---

## Despliegue

```bash
./deploy.sh          # o: npm run deploy
```

Opciones: `--allow-dirty` publica cambios sin commitear y `--allow-downgrade` permite, a propósito, publicar un commit anterior al que corre en producción.

### Qué hace, paso a paso

| Paso | Qué hace | Si falla |
|---|---|---|
| 1. Preflight | Verifica `node`, `npm`, `git`, `curl`, `railway` y `vercel`, y las variables `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `RAILWAY_PROJECT_ID` y `VERCEL_PROJECT_NAME`. Lista **todo** lo que falta de una vez. | sale con `2` |
| 2. Autenticación | Confirma la sesión de Railway y Vercel, vincula el proyecto de Vercel y comprueba que la API tenga sus cuentas de login cargadas en Railway (sin ellas no arranca). | `3`, `2` |
| 3. Estado actual | Toma el commit a publicar, rechaza cambios sin commitear en `apps/`, `scripts/` o `deploy.sh` y exige que ese commit **ya esté en GitHub** (`git push` antes de desplegar), así producción nunca corre código que el repositorio no tiene. Registra la versión que está viva (destino del rollback) y **se niega a volver atrás**: si el commit no contiene lo que corre en producción, frena, porque las migraciones no se revierten y la base quedaría adelantada al código. | `4`, `3` |
| 4. Build local | `npm ci` y build de la API y del frontend. Un error de compilación no llega a producción. | `5` |
| 5. Migraciones | `prisma migrate deploy` contra la base de Railway, a través de su proxy TCP. Solo aplica las pendientes. | `6` |
| 6. Publicación | Publica la API en Railway y espera el estado `SUCCESS` de **ese** deployment. Publica el frontend en Vercel **sin dominio**, lo verifica y recién entonces lo promueve a la URL pública. | `7`, `8` |
| 7. Verificación | `/health` responde `200` con la base arriba y la **versión recién desplegada**, la API **rechaza** llamadas sin sesión (`401`) y el login responde, CORS acepta el origen del frontend, el sitio carga y su bundle apunta a la API pública. Reintenta con espera creciente. | `9` |

Cada falla termina con un mensaje `FAILED` que explica qué pasó y cómo seguir.

**Se puede ejecutar varias veces sin romper nada**: las migraciones solo aplican lo pendiente
y volver a publicar el mismo commit reemplaza el deployment anterior.

### Rollback automático

Si algo falla **después** de publicar la API, el script vuelve atrás solo: republica en Railway
el commit que estaba vivo (desde un `git worktree` temporal), vuelve a promover el frontend
anterior en Vercel y verifica que lo restaurado responda sano. Si la restauración no queda sana,
sale con `10`.

Las migraciones son solo hacia adelante y compatibles con la versión anterior, por eso no se
revierten.

Para ensayar el rollback de punta a punta:

```bash
DEPLOY_SIMULATE_FAILURE=verify ./deploy.sh
```

### Códigos de salida

| Código | Significado |
|---|---|
| `0` | Desplegado y verificado |
| `2` | Faltan herramientas o variables, o el argumento es inválido |
| `3` | Railway o Vercel sin autenticar, o GitHub inaccesible |
| `4` | Cambios sin commitear en lo que se publica, el commit todavía no está en GitHub, o publicarlo llevaría producción a una versión anterior |
| `5` | Falló el build local (no se publicó nada) |
| `6` | Fallaron las migraciones (no se publicó nada) |
| `7` | Falló la publicación de la API (producción sigue en la versión anterior) |
| `8` | Falló la publicación del frontend (con rollback) |
| `9` | Falló la verificación final (con rollback) |
| `10` | El rollback no se completó: producción requiere revisión manual |

### Configuración desde cero

Las variables del despliegue van en `.env` (ver [`.env.example`](.env.example)) o exportadas en
la terminal. Las credenciales de la base **no** se guardan en ningún archivo: el script las lee
de Railway en cada corrida.

```bash
railway login && vercel login

railway init --name mining-equipment-registry
railway add --database postgres
railway add --service api
railway variable set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' PORT=8080 --service api
# cuentas de login: hashes y secreto de `npm --prefix apps/api run auth:hash`
railway variable set AUTH_TOKEN_SECRET=... AUTH_SUPERVISOR_USERNAME=supervisor \
  AUTH_SUPERVISOR_PASSWORD_HASH=scrypt:... AUTH_OPERATOR_USERNAME=operador \
  AUTH_OPERATOR_PASSWORD_HASH=scrypt:... --service api
railway tcp-proxy create --port 5432 --service Postgres
railway domain --service api --port 8080

vercel project create mining-equipment-web
```

Después se completan `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `RAILWAY_PROJECT_ID` y
`VERCEL_PROJECT_NAME`, y se corre `./deploy.sh`.

---

## Uso de inteligencia artificial

Como permite el reto, usé herramientas de IA como apoyo. El diseño, las decisiones de alcance,
la revisión de cada cambio y la publicación fueron míos; puedo explicar cada parte de lo
entregado.

| Herramienta | Para qué la usé |
|---|---|
| **Claude Code** (Claude Opus) | Asistente de programación: análisis del enunciado, propuestas de implementación, pruebas, script de despliegue, CI y redacción de la documentación, siempre bajo mis indicaciones. |
| **gentle-ai** | Organización del trabajo: especificación y bitácora en [`odd/`](odd/) y revisión de riesgo de cada cambio antes de integrarlo. |
| **Engram** | Memoria del asistente entre sesiones de trabajo. |
| **Railway CLI / Vercel CLI / GitHub CLI** | Provisión y despliegue reales. |

Cada regla del dominio tiene pruebas, los cambios de riesgo pasaron por una revisión antes de
integrarse y sus hallazgos se corrigieron en commits propios (`fix(api)`, `fix(web)`,
`fix(deploy)`). La especificación, con los requisitos del enunciado citados textualmente, está en
[`odd/tasks/mining-equipment-registry.md`](odd/tasks/mining-equipment-registry.md).
