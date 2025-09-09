# Repository Guidelines

## Project Structure & Module Organization
- `app/`: Next.js App Router pages and API handlers (`app/api/*/route.ts`).
- `components/`: React components (PascalCase). Shared UI in `components/ui/`.
- `lib/`: Server utilities (file processing, caching, Prisma helpers, retry, etc.).
- `scripts/`: CLI utilities for diagnostics and data workflows.
- `prisma/`: Prisma schema and migrations.
- `types/`, `hooks/`, `stores/`, `contexts/`: TS types and client state.
- `docs/` and `files/`: docs and CSV fixtures used by tests/scripts.

## Build, Test, and Development Commands
- Install deps: `npm ci` (or `npm install`).
- Dev server: `npm run dev` (Next.js).
- Production build: `npm run build`; start: `npm start` or `npm run start:prod`.
- Lint: `npm run lint` (ESLint + next config).
- Prisma: `npx prisma generate`; local dev migration: `npx prisma migrate dev`.
- Scripted tests/examples: `node test_basic.js`, `node scripts/test-api.js`.
- Docker (optional): `docker compose -f docker-compose.optimized.yml up`.

## Coding Style & Naming Conventions
- Language: TypeScript; indent 2 spaces; prefer explicit types at module boundaries.
- React components: PascalCase filenames/exports (e.g., `UploadProgress.tsx`).
- Hooks: `hooks/useThing.ts`; stores: `stores/<name>.ts`.
- Modules/scripts: kebab-case (e.g., `lib/file-processor.ts`, `scripts/check-results.js`).
- API routes: `app/api/<name>/route.ts` returning JSON; keep handlers small and pure.
- TailwindCSS for styling; keep class lists readable and co-located.

## Testing Guidelines
- Tests are Node scripts named `test-*.js` or `test_*.js` in repo root or `scripts/`.
- Run directly with `node <file>`; keep tests deterministic and file-based.
- Use `files/` CSVs as fixtures; add small, focused helpers in `lib/` for unitability.
- See `TEST_GUIDE.md` and `TEST_REPORT.md` for scenarios and expectations.

## Commit & Pull Request Guidelines
- Conventional commits: `feat|fix|refactor|docs|chore: short imperative summary`.
  - Example: `fix: resolve OOM issue by enabling Redis caching`.
- PRs include: summary of problem/solution, linked issues, screenshots for UI,
  test plan (exact commands), and notes on schema/config changes.
- Ensure `npm run lint` and `npm run build` pass before review.

## Security & Configuration
- Required env: `DATABASE_URL` (Postgres), `REDIS_URL` (Redis). Use `.env.local`; never commit secrets.
- Containers write under `/data` only; avoid storing real ad data—use `generate-test-data.py`.
