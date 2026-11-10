# SDE Intern Assignment: Shared Bill Splitter

A production-grade, concurrency-safe bill-splitting web application and API built for shared homes. It calculates exact integer cent bill splits, distributes remainders deterministically based on member join order, handles concurrent payments safely, and guarantees idempotent retries.

---

## Architecture Overview

```
 Browser (React 19 + Vite + TanStack Router)
    │
    │  fetch JSON (/api/* proxied via Vite to :8787)
    ▼
 Cloudflare Worker (Hono API)
    ├── Middleware  : Global JSON error handler, JSON 404 handler
    ├── Validation  : Zero-dependency runtime input validators (400 vs 422)
    ├── Domain      : splitCents(totalCents, memberCount)  [Pure logic & sum invariant]
    ├── Data Access : Prepared statements with parameterized bindings
    │
    │  D1 Binding "DB"
    ▼
 Cloudflare D1 (SQLite Database)
    └── 0001_init.sql with 8 named integrity constraints
```

### Architectural Principles

1. **Database as the Ultimate Line of Defense**: Named constraints prevent invalid state (negative money, duplicate shares, orphan records, half-paid states) even if application code is bypassed.
2. **Atomic Mutations**:
   - Bill & share creation is executed as a single all-or-nothing D1 batch transaction.
   - Share payment is executed as a single conditional `UPDATE ... WHERE paid_at IS NULL RETURNING ...` statement, eliminating race conditions under concurrency.
3. **Pure Domain Logic**: The split calculation is isolated from I/O, completely deterministically distributing remainder cents to the earliest members in join order (`seq`), and asserting the invariant `sum(shares) === totalCents`.
4. **Pessimistic UI with Stable Idempotency**: The UI preserves unpaid state until the API returns HTTP 200. Retries reuse the identical `Idempotency-Key` UUID.

---

## Database Design & Named Constraints

The schema is defined in `api/migrations/0001_init.sql`.

| Constraint Name             | Type                        | Purpose & Protection                                                                               |
| :-------------------------- | :-------------------------- | :------------------------------------------------------------------------------------------------- |
| `ck_bills_total_positive`   | CHECK                       | Prevents zero or negative bill amounts (`total_cents > 0`).                                        |
| `ck_shares_amount_nonneg`   | CHECK                       | Prevents negative share amounts (`amount_cents >= 0`).                                             |
| `uq_shares_bill_member`     | UNIQUE (bill_id, member_id) | Prevents duplicate shares for the same member in a bill.                                           |
| `ck_shares_paid_consistent` | CHECK                       | Prevents half-paid states (`paid_at` and `payment_key` must be either both NULL or both NOT NULL). |
| `ck_homes_name_not_blank`   | CHECK                       | Disallows empty or whitespace-only home names.                                                     |
| `ck_members_name_not_blank` | CHECK                       | Disallows empty or whitespace-only member names.                                                   |
| `ck_bills_title_not_blank`  | CHECK                       | Disallows empty or whitespace-only bill titles.                                                    |
| `fk_members_home`           | Foreign Key                 | Ensures members belong to a valid home.                                                            |
| `fk_bills_home`             | Foreign Key                 | Ensures bills belong to a valid home.                                                              |
| `fk_shares_bill`            | Foreign Key                 | Ensures shares belong to a valid bill.                                                             |
| `fk_shares_member`          | Foreign Key                 | Ensures shares reference a valid member.                                                           |

_Note on member ordering:_ Members are assigned an internal auto-incrementing `seq` column (`INTEGER PRIMARY KEY AUTOINCREMENT`) alongside a public UUID `id`. Sorting by `seq ASC` guarantees deterministic join order even if multiple members are inserted in the same millisecond.

---

## API Specifications

All amounts are integers representing **cents** (`100` cents = $1.00). Decimals are never used in data models or the API.

All error responses strictly return JSON: `{ "error": "message" }`.

### Endpoints

| Method | Endpoint                                 | Success Status                                             | Errors        | Description                                                |
| :----- | :--------------------------------------- | :--------------------------------------------------------- | :------------ | :--------------------------------------------------------- |
| `POST` | `/api/homes`                             | `201 { id, name }`                                         | 400, 422      | Creates a home.                                            |
| `POST` | `/api/homes/:homeId/members`             | `201 { id, homeId, name }`                                 | 404, 422      | Adds a member to a home.                                   |
| `POST` | `/api/homes/:homeId/bills`               | `201 { id, homeId, title, totalCents, shares }`            | 404, 422      | Splits bill between members and creates shares in 1 batch. |
| `POST` | `/api/bills/:billId/shares/:shareId/pay` | `200 { id, memberId, amountCents, paidAt }`                | 400, 404, 409 | Pays a share using `Idempotency-Key` header.               |
| `GET`  | `/api/homes/:homeId/balances`            | `200 { balances: [{ memberId, name, outstandingCents }] }` | 404           | Returns unpaid totals per member in join order.            |
| `GET`  | `/api/homes/:homeId`                     | `200 { id, name, members }`                                | 404           | Reads home details and members list.                       |
| `GET`  | `/api/homes/:homeId/bills`               | `200 { bills }`                                            | 404           | Lists bills and shares (newest first).                     |
| `GET`  | `/api/health`                            | `200 { status: "ok" }`                                     | -             | Health check endpoint.                                     |

---

## Edge Cases Handled

1. **Home with no members:** When creating a bill, the API checks member count and returns `422` with no bill created.
2. **Invalid bill totals:** Rejects `0`, negative numbers, decimals (`10.5`), strings (`"1000"`), and `null` with `422`.
3. **Uneven cent division:** e.g., $10.00 (1000 cents) across 3 members cleanly splits as `[334, 333, 333]` with the remainder cent awarded to the earliest registered member.
4. **Duplicate payment attempts (Same key):** Replaying the same `Idempotency-Key` returns `200` with the original `paidAt` timestamp without re-charging.
5. **Concurrent payments (Different keys):** 10 concurrent requests on the same share yield exactly one `200` and nine `409 Conflict` responses.
6. **Nonexistent / mismatched entities:** Nonexistent homes, bills, or shares return `404`. A share accessed under the wrong bill ID returns `404`.
7. **Network timeouts & 500 crashes:** The web client implements a 10s timeout, handles non-JSON proxy errors, and presents retry buttons without unmounting or crashing the UI.

---

## Decisions

1. **Integrity lives in the database and in atomic statements.**
   - _What was chosen:_ We implemented 8 explicit named constraints (`fk_*`, `ck_*`, `uq_*`) combined with a single conditional `UPDATE ... WHERE paid_at IS NULL RETURNING ...` query and an all-or-nothing D1 batch transaction for bill/share insertion.
   - _Why:_ Even if application code has bugs or high-frequency concurrent requests occur, the database serializes writes and prevents invalid data states without requiring distributed locking or complex read-then-write code. Two concurrent payments for the same share will always result in exactly one write succeeding and one receiving a conflict.

2. **Idempotency key stored directly on the share record.**
   - _What was chosen:_ Instead of introducing an auxiliary idempotency table or external cache, `payment_key` is stored directly as a column on the `shares` table.
   - _Why:_ A share transitions from unpaid to paid exactly once in its lifecycle. Storing the key on the share row guarantees atomic updates, eliminates multi-table synchronization bugs, and makes payment replays trivially deterministic: if the same key is received, the server returns the existing row with its original `paidAt` timestamp.

3. **Integer cents throughout, paired with a pure, invariant-tested `splitCents` function.**
   - _What was chosen:_ Money is strictly represented and transmitted as integer cents (no floating-point numbers). The distribution logic is implemented in a pure domain function `splitCents(totalCents, memberCount)`.
   - _Why:_ Completely avoids IEEE-754 floating-point rounding errors. Remainder cents are allocated sequentially to members in join order (`seq`), and an assertion strictly verifies `sum(shares) === totalCents` before any transaction is executed.

---

## Local Development & Testing

This is a `pnpm` monorepo. No API keys or external services are needed. Everything runs locally with Miniflare and SQLite.

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Run All Tests

Runs all 37 Vitest tests inside the Cloudflare Workers runtime:
```bash
pnpm test
```

### 3. Run Quality & Type Checks

```bash
pnpm check       # Biome formatting and linter check (must pass)
pnpm typecheck   # TypeScript compiler check on api and web (must pass)
pnpm build       # Production build of the web app
```

### 4. Run Development Server

```bash
pnpm dev
```

- Web Application: [http://localhost:5173](http://localhost:5173)
- Hono API: [http://localhost:8787](http://localhost:8787)

---

## Additional Resources

- [VIDEO_GUIDE.md](./VIDEO_GUIDE.md): Word-for-word 3-minute video presentation script and answers for live technical interview questions.
