# Frontend dev mode

A temporary, development-only way to work on the signed-in pages (`/dashboard`, `/sessions`, `/assessment`, `/account`) without Supabase sign-in or email confirmation. It shows fixture data for a labelled mock user. It is not a feature of the product and is meant to be removed once sign-in is routine.

## Turn it on

Add one line to `.env.local` (git-ignored) and restart `pnpm dev`:

```bash
DOJO_DEV_FRONTEND_MODE="true"
```

Then open `/dashboard`, `/sessions` or `/assessment`. A banner says the data is sample data for a mock user. Remove the line, or set anything other than exactly `true`, to turn it off.

## What makes it safe

- It needs both `NODE_ENV !== "production"` and the exact flag value. `next build` and `next start` always run with `NODE_ENV=production`, so a deployed build ignores the flag. This was checked with a production build and server while the flag was set: the workspace pages redirect to sign-in and the PDF route returns 401.
- The guard is one function, `isDevFrontendMode`, in `src/server/auth/dev-frontend-mode.ts`. It has unit tests for every flag value and for production.
- Real authentication is unchanged. `getCurrentUser()` is purely real, so the sign-in and sign-up pages behave as in production. The app pages use `getAppUser()`, which prefers a real signed-in user and falls back to the mock user only in this mode.
- Nothing is written to PostgreSQL or Supabase. The mock user has no database row, and every write (upload, score, delete, delete account) is refused with a plain message instead of pretending to work.
- Fixtures are served only for the mock user. A real signed-in user always reads their own rows from the database, each query scoped to their id.

## Where things are

| What                                      | Where                                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| The flag, the mock user and the guard     | `src/server/auth/dev-frontend-mode.ts`                                  |
| `getAppUser`, `requireUser`               | `src/server/auth/current-user.ts`                                       |
| Deterministic sample data                 | `src/features/dev-frontend/fixtures.ts`                                 |
| The one place pages read a workspace from | `src/features/workspace/workspace-data.ts` (fixtures or the repository) |
| Playwright specs for the mode             | `e2e/dev-frontend-mode.spec.ts`                                         |

The fixtures run the real scoring and metrics code over fixed synthetic sessions with fixed ids and dates, so screenshots and tests are reproducible.

## Limits

- Uploading, scoring, deleting an upload and deleting the account need a real signed-in account. In this mode they show a message saying so.
- The PDF report works, because it is built in memory from the fixture assessment.
- Run the real sign-in Playwright specs with the flag unset or the signed-out redirect spec skips itself.

## Switching back

Delete the `DOJO_DEV_FRONTEND_MODE` line. To remove the mode entirely, delete the guard file, the fixtures, `workspace-data.ts` (point the pages back at `repository.ts`), and the `getAppUser` branch in `current-user.ts`.
