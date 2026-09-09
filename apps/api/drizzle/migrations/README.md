# Database migrations

Generated and applied with **Drizzle** (`drizzle-kit` + `drizzle-orm/node-postgres`).

## Rules (Architecture Decisions D7 / D21)

- Every schema change is a numbered `NNNN_name.sql` file here, committed to Git and code-reviewed.
- Migrations are applied **in order**, only by the explicit `db:migrate` command.
- The running application **never** creates or alters tables. No "auto-sync on boot".
- Never edit an already-applied migration or the database by hand — add a new migration.

## Commands (run from repo root)

| Command                | What it does                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm run db:generate` | Diff `src/core/database/schema/index.ts` against the last snapshot and write a new migration |
| `pnpm run db:migrate`  | Apply all pending migrations                                                                 |
| `pnpm run db:status`   | Show which migrations are applied / pending                                                  |
| `pnpm run db:check`    | Validate the migration history for consistency / collisions                                  |

## Layout

```
drizzle/migrations/
├── meta/
│   ├── _journal.json      ordered list of migrations (starts empty)
│   └── NNNN_snapshot.json  schema snapshot after each migration
└── NNNN_name.sql          the SQL for each migration
```

Drizzle tracks applied migrations in the `drizzle.__drizzle_migrations` table.

Phase B-2-1: infrastructure only — **no migrations yet**.
