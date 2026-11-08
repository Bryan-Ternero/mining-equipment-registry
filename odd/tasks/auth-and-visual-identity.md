# Role-based login and new visual identity

Objective: add a working role-based login (two roles), restyle the whole system after the Webpixels "Bootstrap Table Screen" reference, and let each maintenance record its date, time and comments.
Branch: `feat/auth` (stacked on `feat/docs`). Delivery strategy: `ask-on-risk`, chain strategy `stacked-to-main` (cached from mining-equipment-registry L7). Test runner: Vitest.

## Specs

User request quoted verbatim (2026-11-08):

- **S1** Login: "necesito un login" … "el login debe funcional basado en roles con 2 roles".
- **S2** Login layout: "tener un diseño 60/40, 60% imagen de referencia de lo que trata mas el nombre del proyecto,40% login".
- **S3** Visual identity: "un cambio completo de identidad visual,guiate del siguiente diseño para todo el sistema (https://dribbble.com/shots/21602075-Bootstrap-Table-Screen-Webpixels)".
- **S4** Maintenance record: "cada que se haga un mantenimiente se guarde la fecha y hora en que se realizo y los comentarios".
- **S5** Roles (proposal accepted by the user, "me sirve"):

  | | Supervisor | Operador |
  |---|---|---|
  | Ver equipos e historial | ✅ | ✅ |
  | Registrar mantenimiento | ✅ | ✅ |
  | Actualizar horómetro | ✅ | ✅ |
  | Crear, cambiar tipo y eliminar equipos | ✅ | ❌ |

### Assumptions (stated to the user, not contested)

- A1 Project name shown on the login: "Registro de equipos mineros".
- A2 Two fixed accounts (one per role) defined by environment variables; no user-management screen. Passwords stored only as scrypt hashes.
- A3 Login image: `login-haul-truck.jpg` from the previous project's backup.
- A4 The Dribbble page cannot be fetched (empty response); the style follows the public Webpixels CSS conventions: Inter, indigo primary, gray-50 background, white cards with soft shadows, uppercase muted table headers, dot badges.
- A5 Editing the code of an equipment counts as supervisor-only (identity of the equipment), like its type.
- A6 S4 is already stored by the API (`performedAt`, `notes`); the gap is the UI (date/time input) and who performed it (`performedBy`, new column).
- A7 `/health` stays public (the deploy and the evaluator need it).

## Tasks

| ID | Specs | Route | Status | Commit / evidence |
|---|---|---|---|---|
| T1 | S1, S5 | inline | done | `2acf031` + correction `0f5667b`; RDD risk/resilience/reliability: correction (guard bypass via `/%61pi/`, forged X-Forwarded-For) reproduced RED, fixed, validated, approved |
| T2 | S4 | inline | done | `8aa1c85`; migration `20261108120000_maintenance_performed_by` (nullable column); under_budget, reviewed with T3 slice |
| T3 | S1-S5 | inline | done | `6fcef95` + `7b5571e`; web unit 12/12; Edge headless screenshots (login 60/40, dashboards per role, dialog, phone); reload-with-session bug found by screenshots and fixed; RDD approved |
| T4 | S1 | inline | done | `01fe7fb`; preflight exit 2 observed with missing AUTH_*; deploy exit 0, `/health` 01fe7fb, anon 401, encoded path 401, operator create 403; RDD declined by user |

Route evidence: one sequential feature (web depends on the auth contract), no Writer trigger reason; the parent writes inline.

## Log

- **L1** (2026-11-08, user, verbatim): "necesito un login y un cambio completo de identidad visual,guiate del siguiente diseño para todo el sistema (https://dribbble.com/shots/21602075-Bootstrap-Table-Screen-Webpixels),el login debe funcional basado en roles con 2 roles y tener un diseño 60/40, 60% imagen de referencia de lo que trata mas el nombre del proyecto,40% login,ademas necesito que cada que se haga un mantenimiente se guarde la fecha y hora en que se realizo y los comentarios,si necesitas algo mas de informacion dimelo."
- **L2** (2026-11-08, user, verbatim): "me sirve" — accepts the roles table (S5) and the stated assumptions.
- **L3** (2026-11-08): hash separator is ":" because dotenv expands "$NAME" in .env values. trustProxy limited to the platform hop (function form; Fastify 5 types reject a number). The login check is skipped when verifying a rollback, which may restore a pre-login version. Production accounts: usernames `supervisor` / `operador`, only scrypt hashes in Railway.
- **L4** (2026-11-08, user, verbatim except the redacted secret): "responde en español,recuerda que debes usar gentle ia,ademas debes cambiar las contraseñas modificar ambas por [contraseña omitida]". Both production passwords replaced with one user-chosen password (user decision for the evaluation demo; warned it is shorter than the 8-character minimum `auth:hash` enforces). The password itself is never written to the repository. Hashes generated with the API's own `hashPassword`, verified against the stored Railway values, applied with `./deploy.sh`. Configuration-only change: no code commit, so no gentle-ai review candidate. Deploy evidence in T4. Follow-ups (advisory): token in localStorage (XSS exposure, accepted for a static SPA on another origin), Google Fonts third-party load, interval numbers hardcoded on the pre-login screen.
- **L5** (2026-11-08, user chose option A): before the first push, the `feat/auth` history was rewritten (`git filter-branch --tree-filter`, 9 commits) to remove the local demo login credentials that `2acf031` had put in `docker-compose.yml` and the README. Verified: no branch contains them, and the final tree is byte-identical to the pre-rewrite tip. Commit hashes in this document were updated to the rewritten ones. Production still reports the pre-rewrite version `e61a33f` (same tree as `d25be5e`); that hash no longer exists, so the next deploy has no API rollback target (it warns and continues) and the one after it works normally.
