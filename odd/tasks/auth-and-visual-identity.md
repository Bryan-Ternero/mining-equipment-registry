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
| T1 | S1, S5 | inline | pending | API auth: scrypt hashes, signed tokens, login + me, guard on `/api/*`, role checks, login throttling, tests |
| T2 | S4 | inline | pending | `performedBy` migration, set from the session; API tests |
| T3 | S1-S5 | inline | pending | Web: new design system, app shell, 60/40 login, role-aware actions, maintenance date/time + comments |
| T4 | S1 | inline | pending | Deploy: auth variables in preflight and Railway, verifier checks the API rejects anonymous calls; README; real deploy |

Route evidence: one sequential feature (web depends on the auth contract), no Writer trigger reason; the parent writes inline.

## Log

- **L1** (2026-11-08, user, verbatim): "necesito un login y un cambio completo de identidad visual,guiate del siguiente diseño para todo el sistema (https://dribbble.com/shots/21602075-Bootstrap-Table-Screen-Webpixels),el login debe funcional basado en roles con 2 roles y tener un diseño 60/40, 60% imagen de referencia de lo que trata mas el nombre del proyecto,40% login,ademas necesito que cada que se haga un mantenimiente se guarde la fecha y hora en que se realizo y los comentarios,si necesitas algo mas de informacion dimelo."
- **L2** (2026-11-08, user, verbatim): "me sirve" — accepts the roles table (S5) and the stated assumptions.
