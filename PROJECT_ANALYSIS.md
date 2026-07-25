# PROJECT_ANALYSIS.md — vira-next

## Project Purpose
A bilingual (Persian/RTL) corporate marketing site and internal operations portal for "Vira" (domain `viraap.co`), likely a software/IT services company. Public pages: Home, About, Services, Projects, Blog, Contact. Authenticated area (`/dashboard`) branches into three role-based consoles: Admin (content/CMS + HR), Worker (time tracking, day-off requests), Client (tickets/support). Originally scaffolded by Lovable with Supabase, later migrated to a custom Express + MSSQL backend — Supabase artifacts remain but are unused.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite (SWC), React Router v6, TanStack Query, Zustand, shadcn/ui (Radix) + Tailwind, React Hook Form + Zod, Recharts, `jalaali-js`/`moment-jalaali`.
- **Backend**: Express 5, `mssql` (SQL Server), JWT, `bcryptjs`, `multer`, `dotenv`, `cors`.
- **Tooling**: ESLint 9 flat config, no test framework, `concurrently` for dev, both `package-lock.json` and `bun.lockb` committed (mixed package managers).

## Folder Structure
```
src/            React app (pages, components, hooks, lib, integrations, utils)
server/         Express API (routes, middleware, config, utils)
database/       Raw SQL Server schema files (manually applied, no migration tool)
scripts/        Admin seeding, Supabase→SQL data migration, server launcher
public/         Static assets + uploaded images (served from disk, committed to repo)
```
No `controllers`/`services` layer — route files mix HTTP handling, SQL, and business rules.

## Frontend Architecture
- SPA, routes defined in `App.tsx`; no code-splitting — everything bundles together.
- `src/lib/api.ts` is a hand-rolled singleton `ApiClient` wrapping `fetch` (~40 methods, no per-domain split).
- Global state via Zustand (`useAuth`); `useAuthStore.tsx` is a bare re-export alias — leftover refactor debt.
- `src/components/ui` is the shadcn/ui vendor library; feature code lives under `dashboard/`, `worker/`, `layout/`.
- Several dashboard components are oversized single files (AdminDashboard.tsx ~47KB, WorkerManagement.tsx ~45KB, WorkerCalendar.tsx ~30KB) — "god component" pattern mixing fetch/state/UI.
- `src/integrations/supabase/*` (client + generated types) is dead code — nothing imports it post-migration.

## Backend Architecture
- Flat Express app: `server.js` mounts ten route modules directly, no versioning, no controller/service/repository split.
- Single lazily-created MSSQL connection pool reused across requests.
- Several routes run `ALTER TABLE`/`CREATE TABLE IF NOT EXISTS`-style DDL at request time (`ensureWorkerTypeColumn`, `ensureHolidaysTable`) instead of migrations — schema drift risk and DDL on the hot path.
- No centralized error handler or logging library (only `console.error`), no server-side validation layer (Zod is a dependency but only used client-side).

## Database & ORM
- SQL Server, no ORM — parameterized queries via `mssql` `.input()` bindings (protects against injection).
- Schema lives in two plain `.sql` files meant to be run manually, plus ad-hoc runtime `ALTER TABLE` calls — no single source of truth.
- `updated_at` is set both by DB triggers and manually in some queries — redundant.
- Tables: `users`, `profiles`, `blogs`, `contact_submissions`, `ticket_responses`, `time_logs`, `day_off_requests`, `holidays`, `services`, `projects`. `services.features`/`projects.tags` are JSON stored as `NTEXT`, parsed in app code.

## API Overview
REST-ish JSON API under `/api`: `auth`, `blogs`, `contact`, `submissions`, `tickets`, `profiles`, `workers` (time logs/day-off/holidays), `services`, `projects`, `uploads`. Conventional CRUD per resource, but `contact` and `tickets` implement near-identical ticket-response endpoints twice.

## Authentication & Authorization
- JWT (24h expiry, single secret, no refresh) issued on signup/signin; stored in `localStorage` (XSS-exposed).
- `authenticateToken` sets `req.user = { id, email, role }`.
- **Bug**: several `workers.js` handlers check `req.user.userId`, a field that doesn't exist on the token — ownership checks for day-off/time-log routes always evaluate false, breaking self-service for non-admin workers.
- `requireAdmin` checks role only; no resource-level ownership checks beyond that.
- No rate limiting on auth routes; no password complexity rule on signup (only a 6-char minimum on change-password).

## State Management
TanStack Query is installed but underused — most dashboard data-fetching is manual `useEffect` + `apiClient` rather than `useQuery`. Auth/global state lives in a Zustand store (`user`, `loading`, `isInitialized`).

## Core Business Logic
Role-based dashboards drive all authenticated functionality. HR-style time tracking (two shift windows/day) and day-off requests capped at 26 approved days per Jalali year, enforced server-side. Jalali calendar conversion is duplicated in `server/utils/jalali.js` and `src/utils/jalali.ts`. Blog rich text uses a custom allow-list HTML sanitizer (`src/lib/richText.ts`) rather than a vetted library like DOMPurify.

## Main Features
Marketing site with SEO head component; signup/signin/change-password; admin CMS for blogs/services/projects; contact/ticket support workflow; worker time & leave management with a holiday calendar; image upload for blog/project assets.

## Build & Deployment
`npm run start` runs the Vite dev server and Express concurrently — a dev-mode script, not a production build/deploy pipeline (no production `build`+`serve` flow, no Dockerfile, no CI config). `vite.config.ts` hardcodes `allowedHosts` for `viraap.co`. No `.env.example`; required vars (`DB_*`, `JWT_SECRET`, `PUBLIC_API_URL`) are undocumented.

## Dependencies
Reasonably current major versions (React 18, Express 5, Vite 5). Two Jalali-date libraries (`jalaali-js` and `moment-jalaali`) serve the same purpose — redundant. Mixed npm/Bun lockfiles suggest inconsistent tooling across contributors.

## Code Quality
- Inconsistent module style (dead `require`/`module.exports` comments left beside ESM imports).
- `auth.js` places `export default router` before the `/change-password` route — still functions (module code runs top-to-bottom regardless of `export` position) but is confusing and fragile.
- `ensureWorkerTypeColumn` is copy-pasted across `auth.js`, `profiles.js`, `workers.js`.
- Real bug: `checkResult.recordset.lenFgth` typo in `workers.js` (day-off delete route) throws instead of returning 404.
- `src/lib/api.ts` hardcodes `http://localhost:5000/api`; the env-var version is commented out, so production builds would call localhost.
- No automated tests anywhere.

## Technical Debt
Dead Supabase integration; no migration framework; oversized dashboard components; duplicated ticket-response logic between `contact.js` and `tickets.js`; mixed lockfiles.

## Performance Issues
No pagination on list endpoints (`blogs`, `projects`, `services`, `profiles`, `contact_submissions` all unbounded `SELECT *`). Global `express.json({ limit: '50mb' })` is excessive outside the upload routes (which already cap file size via multer), inflating memory/DoS exposure. No caching layer despite TanStack Query being available. Runtime DDL checks add latency/fragility to unrelated requests.

## Security Issues
`cors()` has no origin allow-list. JWT in `localStorage` is XSS-exposed rather than an httpOnly cookie. The `req.user.userId` bug is currently fail-closed but signals fragile authorization logic. No rate limiting on `/auth/signin`/`signup`. No centralized server-side input validation — malformed/oversized payloads reach the DB layer directly. Upload validation relies only on MIME-type sniffing, not file-signature checks.

## Scalability Concerns
Single connection pool (max 10) with no read replicas or CDN/caching strategy for otherwise-cacheable marketing pages. No background/queue mechanism (email/notifications appear to have been cut entirely). Frontend ships as one bundle with no route-based code splitting.

## Refactoring & Redesign Opportunities
- Add a service/repository layer server-side and a real migration tool instead of runtime DDL.
- Consolidate duplicated column-bootstrap and ticket-response logic.
- Use Zod (already a dependency) for server-side validation, sharing schemas with the frontend.
- Split large dashboard components into data hooks (TanStack Query) + presentational pieces.
- Remove dead Supabase code, standardize on one Jalali library, drop one lockfile.
- Move JWT to httpOnly cookies or add refresh-token rotation; add a CORS allow-list and auth rate limiting.
- Add pagination/filtering to list endpoints; right-size the JSON body limit.

## Evaluation Against Senior Engineering Standards
- **Clean Architecture / SOLID / Separation of Concerns**: Weak — routes and large components mix HTTP/SQL/business logic/UI/state.
- **DRY**: Violated (column bootstrap, ticket responses, Jalali conversion duplicated client/server).
- **KISS**: Backend route logic itself is simple and readable — a genuine strength.
- **Modular Design**: The shadcn/ui layer is well organized; feature/domain code is not.
- **Secure Coding**: Parameterized SQL is solid; token storage, CORS, and rate limiting are gaps.
- **Testability**: No tests; tight coupling to singletons (`getConnection`, `fetch`) would hinder unit testing.
- **Error Handling & Logging**: Consistent try/catch with generic 500s, but no structured logging or centralized error middleware.
- **API Design**: Consistent REST conventions but no versioning, no schema docs, some duplicated endpoints.
- **Database Design**: Reasonable normalization; JSON-in-text columns are a minor smell; missing migrations is the bigger issue.
