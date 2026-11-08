# Mining equipment registry — rebuild from scratch

Objective: rebuild the challenge app (equipment registry + one-command deploy) from an empty repo and verify every requirement of the challenge PDF.
Branch: `feat/equipment-registry` (bootstrap commit on `main`). Delivery strategy: `ask-on-risk`. Test runner: Vitest (`npm test`, `npm run test:int`).

## Specs

Quoted verbatim from `reto-fullstack-aplicacion-publicada-con-despliegue-automatiz.pdf` (Spanish, original wording kept).

- **S1** App CRUD: "Crear, listar, editar y eliminar equipos: código, tipo (camión, excavadora, perforadora) y horómetro (horas de uso)."
- **S2** Maintenance warning: "Cada tipo tiene un intervalo de mantenimiento en horas. Si un equipo lo alcanza, debe mostrarse como \"Requiere mantenimiento\"."
- **S3** Maintenance record: "Registrar un mantenimiento deja historial y reinicia el ciclo del equipo."
- **S4** Separate services: "Frontend y backend separados, cada uno con su propia URL pública. Pueden estar en un solo repositorio o en dos."
- **S5** API: "Backend con API REST y una ruta /health que responda si el servicio está bien."
- **S6** DB: "Base de datos relacional (PostgreSQL o MySQL)."
- **S7** Secrets: "Sin claves en el repositorio: incluye un .env.example."
- **S8** Deploy command: "Un solo comando de terminal, por ejemplo ./deploy.sh o make deploy, que:
  1. Verifique lo necesario antes de empezar (herramientas y variables de entorno).
  2. Construya y publique el frontend y el backend.
  3. Aplique las migraciones de la base de datos.
  4. Compruebe al final que ambos servicios responden, usando /health en el backend.
  5. Termine con un error claro y un código de salida distinto de 0 si algún paso falla.
  Debe poder ejecutarse varias veces sin romper nada."
- **S9** Delivery: "Repositorio o repositorios de GitHub, públicos." / "URL pública del frontend." / "URL pública del backend."
- **S10** README: "README con qué hace, cómo levantarlo en local y cómo desplegarlo." and "Indica en el README qué herramientas usaste".
- **S11** Optional extras: "Vuelta a la versión anterior si el despliegue falla." / "Docker o docker-compose." / "GitHub Actions." / "Pruebas automatizadas."
- **S12** Video script support (user records it): "haz un cambio visible, súbelo a GitHub, ejecuta tu comando en la terminal y muestra el cambio ya publicado."

### Assumptions (marked, not user requirements)

- A1 Intervals: CAMION 250 h, EXCAVADORA 500 h, PERFORADORA 300 h, stored in a type catalogue table.
- A2 "Reinicia el ciclo" is literal: a service stores `lastServiceHours = hourmeter at service`; the warning is `hourmeter - lastServiceHours >= interval` (inclusive, "lo alcanza"). Derived, never stored.
- A3 A new equipment starts its cycle at 0 h, so a unit registered with more hours than its interval is flagged until serviced.
- A4 The hourmeter cannot be edited below the reading of the last service (it would make the cycle negative).
- A5 Deleting equipment deletes its history (cascade).
- A6 No login: the challenge does not ask for one and it would block the evaluator.
- A7 Hosting: Railway (API + PostgreSQL) and Vercel (frontend), same stack as the previous version.

## Tasks

| ID | Specs | Route | Status | Commit / evidence |
|---|---|---|---|---|
| T1 | S7 | inline | blocked (`.env.example`) | `94e12ec`; `.env.example` blocked by a user deny rule on `.env*`, content ready in scratchpad for the user to copy |
| T2 | S1-S3, S5, S6 | inline | done | `96bb189` `f56f48c` `b349af3` `b07b3b6`; unit 5/5, integration 21/21 on PostgreSQL 18; RDD risk+reliability approved, fix resilience+reliability approved |
| T3 | S1-S3, S4 | inline | done | `db18e94` `751ba16` `a4f345a`; web unit 5/5; RDD readability+reliability approved; fix under_budget |
| T4 | S8, S11 (rollback) | inline | done | `9c7e1ef` `0a374a7` `d634973` `0fbc0e5` `6abc026`; RDD risk+resilience+reliability approved; `0a374a7` declined by user |
| T5 | S11 | inline | done | `762d8fc`; `docker compose --profile full up` verified healthy (db→migrate→api→web, CORS 201); ShellCheck clean via Docker |
| T6 | S4, S9 | inline | partial | Railway `mining-equipment-registry` (api + Postgres + TCP proxy), Vercel `mining-equipment-web`; deploy verified. GitHub public repo creation blocked by auto mode, needs user approval |
| T7 | S1-S12 | inline | in progress | README written; point-by-point verification in L9 |

Route evidence: no Writer trigger reason (units are sequential and dependent: web needs the API contract, deploy needs both), so the parent writes inline.

## Log

- **L1** (2026-11-07, user, verbatim): "Puedes eliminar todo y crear el proyecto desde 0, verificando punto por punto que se cumpla todo,primero entrega el plan y luego comienza el desarrollo"
- **L2** (2026-11-07, user): scope confirmed as "Todo, incluido lo remoto"; authorized using the existing `gh`, `railway` and `vercel` sessions to delete the old repo and projects after a local backup. "Si,recuerda que debes usar gentle ai y odd"
- **L3** (2026-11-07): backup at `C:\Users\User\Downloads\mineops-backup-2026-11-07\` (`mineops-full.bundle` verified complete, `worktrees.tar.gz` with env files). Deleted Railway project `mineops`, Vercel project `mineops-web`, worktree `veta-wt` and local files. Kept `.atl/` (gentle-ai registry) and the ignored reference copy `miners-fullstack-challenge-main/`. GitHub repo deletion pending: `gh` lacks the `delete_repo` scope.
- **L4** (2026-11-07): user approved the `gh` device flow; `Bryan-Ternero/mineops-equipment-registry` deleted (GitHub returns "Could not resolve"). Phase 0 complete.
- **L5** (2026-11-07): T2 built. Pinned the dependency majors validated by the previous production (Prisma 6, Vitest 3, TS 5, ESLint 9): latest Prisma is an RC and Prisma 7 changes the connection setup. Type catalogue is inserted by the init migration (no separate seed in the deploy). Prisma blocks `migrate reset` for AI agents, so the integration setup uses the non-destructive `migrate deploy` and each test deletes its own rows. Test caught a double error on an empty code; fixed with `abort: true`. Engram mirror pending (auto mode could not review the call).
- **L6** (2026-11-07, user, verbatim): "Ya está docker abierto,todo lo que sea engram se guardará al final del proyecto" — Engram mirror deferred to project close by user decision.
- **L7** (2026-11-07, user): delivery chain strategy "stacked-to-main". Slices: bootstrap on `main`; `feat/api` (domain+schema, then REST+integration tests); `feat/web` stacked on `feat/api`; then deploy, CI/docker, docs. Each slice becomes a PR to `main` once the GitHub repo exists; merging stays the user's decision.
- **L8** (2026-11-08): deploy evidence. Runs 1-3 failed with exit 5 before publishing anything (Windows EPERM: local dev servers held `node_modules`; hint added in `6abc026`). Run 4: exit 0, migration `20261108000000_init` applied, `/health` reports `0fbc0e5`. Run 5 (same commit): exit 0, "No pending migrations to apply", data preserved. Run 6 with `DEPLOY_SIMULATE_FAILURE=verify`: exit 9, API and web restored to the previous deployment and re-verified healthy. Railway exposes no `DATABASE_PUBLIC_URL`: URL built from the TCP proxy parts (`d634973`). Vercel preview URLs are behind Deployment Protection: candidate check degrades to a warning, the public URL is verified after promotion.
- **L9** (2026-11-08) point-by-point vs the PDF: S1 CRUD ✅ (integration + production curl); S2 warning inclusive per type ✅; S3 history + cycle restart ✅; S4 separate public URLs ✅ (Vercel + Railway); S5 REST + /health with db check ✅; S6 PostgreSQL ✅; S7 no secrets committed ✅, `.env.example` ⏳ (blocked); S8.1-5 ✅ (exit codes 2-10 observed: 2, 5, 9, 0); idempotent ✅; S9 repo ⏳ (needs user approval), URLs ✅; S10 README ✅; S11 rollback ✅, docker-compose ✅, Actions ✅ (first run pending push), tests ✅; S12 video: user records it.
- Follow-ups (advisory review findings, not blocking): lock wait timeout handling, CHECK-conflict mapping test, Vercel protection on previews, Railway restart retries.
