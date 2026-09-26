# Database notes

## Current: SQLite via `node:sqlite`

Chosen because Node 22.5+ ships the driver. No install step, no server process,
no network call. For a demo with a hard deadline, "it cannot fail to start" is
worth more than concurrent write throughput.

The three things the design actually depends on all work:

| Need | SQLite | Where |
|---|---|---|
| Non-negative on-hand, enforced by the DB | `CHECK (quantity >= 0)` | `schema.sql` |
| Reservation can never exceed on-hand | `CHECK (reserved <= quantity)` | `schema.sql` |
| Ledger cannot be edited | `CREATE TRIGGER ... RAISE(ABORT)` | `schema.sql` |

## The stock guard

The concurrency guard is one statement, not a read followed by a write:

```sql
UPDATE inventory
   SET quantity = quantity - ?
 WHERE product_id = ? AND location_id = ?
   AND quantity - reserved >= ?
```

If it matches zero rows, the shipment is refused. Two concurrent deliveries of
the last 10 units cannot both succeed. The `CHECK` constraint is the second line
of defence, not the primary guard.

## Migrating to PostgreSQL

If Supabase or a hosted Postgres becomes available, the changes are mechanical:

1. `schema.sql` — replace `INTEGER PRIMARY KEY AUTOINCREMENT` with
   `BIGSERIAL PRIMARY KEY`, `datetime('now')` with `now()`, and
   `INTEGER` booleans with `BOOLEAN`. The `CHECK` constraints and the
   append-only triggers need a different mechanism:
   ```sql
   REVOKE UPDATE, DELETE ON ledger_entries FROM app_user;
   ```
   or a `BEFORE UPDATE OR DELETE` trigger that raises.
2. `db/index.js` — swap `DatabaseSync` for the `pg` client. Keep
   `transaction()` as the single place `BEGIN`/`COMMIT` is issued.
3. `services/engine.js` — no change. The guarded `UPDATE` is valid PostgreSQL.
4. `services/validation.js`, `services/integrity.js` — no change. The
   aggregation queries are standard SQL.

`int8` sums as strings in `pg`, so `SUM(quantity_change)` needs a cast to
`::int` when read back in `checkIntegrity()`.

## Entity resolution is a demo dependency

`resolveEntities()` in `services/validation.js` matches on normalised name or
code, with exact → prefix → partial scoring. Seed names are deliberately
unambiguous so that a failed demo can never be blamed on ambiguous input.
Keep it that way if the catalogue grows.
