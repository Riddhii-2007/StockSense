# StockSense

An inventory management system focused on safe, AI-assisted inventory execution.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS v3
- **Backend:** Node.js + Express.js
- **Database:** SQLite via Node's built-in `node:sqlite` driver
- **AI:** Anthropic Claude API (optional — a deterministic parser is the floor)

## Why SQLite

Node 24 ships `node:sqlite`, so there is nothing to install, no server to run,
and no network dependency. The demo cannot fail because a database is down.
`CHECK` constraints, transactions and guarded `UPDATE`s all behave as needed,
and the stock guard in `services/engine.js` is plain SQL that ports to
PostgreSQL unchanged.

See `docs/DATABASE.md` for the PostgreSQL migration path.

## Running it

Two terminals.

```bash
# Terminal 1 - backend on :5000
cd backend
npm install
npm run dev
```

```bash
# Terminal 2 - frontend on :5173
cd frontend
npm install
npm run dev
```

The backend seeds itself on first boot and refuses to start if the ledger does
not reconcile:

```
Ledger integrity at boot: OK (10 entries, 0 discrepancies)
```

## Verifying it

```bash
cd backend
npm run verify
```

59 end-to-end checks covering the guarantees the demo rests on: a blocked
operation writes nothing, posting requires READY, cancelling releases the
reservation, the ledger rejects edits, and balances always equal the sum of
ledger entries.

## Resetting demo data

With the server running:

```bash
cd backend
npm run reset
```

Or `POST /api/demo/reset`. This is the button to put in the UI before presenting.

## Demo accounts

| Email | Password | Role |
|---|---|---|
| admin@stocksense.com | admin123 | ADMIN |
| manager@stocksense.com | manager123 | MANAGER |
| staff@stocksense.com | staff123 | STAFF |

## The one rule

`/api/operations/preview` and `/api/operations/:id/post` call the same
`validateOperation()` on the server. A preview can never approve something the
commit then refuses. Stock is never computed in the browser, and the natural
language parser is treated as untrusted input that goes through those same
rules.

## API

Full contract with request and response shapes: [`backend/API.md`](backend/API.md)

## Project Structure

```
StockSense/
├── frontend/                    # React + Vite
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/            # one api client
│       ├── hooks/
│       ├── utils/
│       ├── App.jsx
│       └── main.jsx
│
├── backend/                     # Express API
│   ├── src/
│   │   ├── routes/              # products, operations, ledger, auth, ...
│   │   ├── services/            # engine, validation, integrity, nlp
│   │   ├── db/                  # schema.sql, connection, seed
│   │   ├── utils/
│   │   ├── config/
│   │   └── server.js
│   ├── scripts/verify.mjs
│   ├── data/                    # SQLite file (gitignored)
│   ├── API.md
│   └── .env.example
│
├── docs/DATABASE.md
└── README.md
```
