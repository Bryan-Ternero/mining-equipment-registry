# Registro de equipos mineros

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
| **Intervalo por tipo** | Camión cada **250 h**, excavadora cada **500 h**, perforadora cada **300 h**. Los intervalos viven en la tabla `equipment_types`. |
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

### Qué hace, paso a paso

| Paso | Qué hace | Si falla |
|---|---|---|
| 1. Preflight | Verifica `node`, `npm`, `git`, `curl`, `railway` y `vercel`, y las variables `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `RAILWAY_PROJECT_ID` y `VERCEL_PROJECT_NAME`. Lista **todo** lo que falta de una vez. | sale con `2` |
| 2. Autenticación | Confirma la sesión de Railway y Vercel, vincula el proyecto de Vercel y comprueba que la API tenga sus cuentas de login cargadas en Railway (sin ellas no arranca). | `3`, `2` |
| 3. Estado actual | Toma el commit a publicar, rechaza cambios sin commitear en `apps/`, `scripts/` o `deploy.sh` y exige que ese commit **ya esté en GitHub** (`git push` antes de desplegar), así producción nunca corre código que el repositorio no tiene. Registra la versión que está viva: es el destino del rollback. | `4`, `3` |
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
| `4` | Cambios sin commitear en lo que se publica, o el commit todavía no está en GitHub |
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

| Herramienta | Para qué |
|---|---|
| **Claude Code** (Claude Opus) | Agente de código: análisis del enunciado, implementación, pruebas, script de despliegue, CI y documentación, con decisiones de alcance tomadas por mí. |
| **gentle-ai** | Flujo de trabajo del agente: Organic Driven Development (ODD) con especificación y bitácora en [`odd/`](odd/), y revisión de riesgo por cada commit (lentes de riesgo, confiabilidad, resiliencia y legibilidad). |
| **Engram** | Memoria persistente del agente entre sesiones. |
| **Railway CLI / Vercel CLI / GitHub CLI** | Provisión y despliegue reales. |

Cada regla del dominio tiene pruebas, cada commit de código pasó por la evaluación de riesgo
de gentle-ai, y los hallazgos de esas revisiones se corrigieron en commits propios
(`fix(api)`, `fix(web)`, `fix(deploy)`). La especificación completa, con los requisitos del
enunciado citados textualmente, está en [`odd/tasks/mining-equipment-registry.md`](odd/tasks/mining-equipment-registry.md).
