# To-do list web app

A small, genuinely useful to-do dashboard: track every task through three
states (Not Started → In Progress → Completed), with a priority, an optional
description, due date and thumbnail. Everything is stored in SQLite, so your
list survives a restart.

**Stack:** Node.js + Express 5 for the API, the built-in `node:sqlite` module
for storage, and a React 19 + TypeScript dashboard built with Vite. Express is
the only production dependency.

## The interface

```
┌────────────┬──────────────────────────────────────────────┐
│  Sidebar   │  brand · search · notifications · date       │
│  avatar    ├──────────────────────────────────────────────┤
│  nav       │  Welcome back, Sundar 👋      avatars  Invite │
│  logout    │  ┌────────────────────┐ ┌──────────────────┐ │
│            │  │ To Do   + Add Task │ │ Task Status ◔◑◕ │ │
│            │  │ ┌────────────────┐ │ │ Completed  40%  │ │
│            │  │ │ status card    │ │ │ In Progress 40% │ │
│            │  │ └────────────────┘ │ │ Not Started 20% │ │
│            │  └────────────────────┘ ├──────────────────┤ │
│            │                        │ Completed Task    │ │
│            │                        └──────────────────┘ │
└────────────┴──────────────────────────────────────────────┘
```

* **Sidebar** — Dashboard, Vital Task (high priority and unfinished), My Task
  (everything), Task Categories (Not Started / In Progress / Completed),
  Settings and Help.
* **Task cards** — click the coloured dot to cycle a task's state; the donut
  charts and the completed list follow along.
* **Invite**, **Logout** and **Settings** are presentational for now.

## Requirements

* Node.js 22.5 or newer (developed and tested on 24.21.0). The floor comes from
  `node:sqlite`, which needs no native build step and no extra driver.
* Any modern browser

## Run it

```bash
npm install        # installs express (the only dependency)
npm start          # http://127.0.0.1:8000/
```

For development with an automatic restart on every file change:

```bash
npm run dev
```

Useful flags:

```bash
node src/index.js --port 9000          # different port
node src/index.js --host 0.0.0.0       # expose on the local network
node src/index.js --db ./data/mine.db  # choose the SQLite file
node src/index.js --help               # usage and the full API list
```

Press `Ctrl+C` to stop. Tasks are written to `data/todos.db` by default.

## The two front-ends

Both UIs talk to the same API, so pick whichever fits the moment.

| | `web/` (React + TypeScript) | `public/` (no build) |
| --- | --- | --- |
| Build step | Vite + `tsc` | none |
| Served by | Vite dev server, or `npm start` after `npm run web:build` | `npm start` directly |
| Interface | full dashboard | simple list, same fields |

`src/index.js` serves `web/dist` when it exists and otherwise falls back to
`public/`, so the app is useful before you ever install the UI toolchain.

### Working on the React UI

```bash
npm run web:install     # once: installs React, Vite, TypeScript, Vitest
npm run web:dev         # Vite dev server on http://127.0.0.1:5173
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8000` (see the
`API_TARGET` constant in `web/vite.config.ts`), so run the API alongside it in a
second terminal — `npm start`. Because the proxy keeps everything on one origin,
there is no CORS configuration anywhere.

To ship it as a single server:

```bash
npm run web:build       # type-checks, then emits web/dist
npm start               # now serves the built React app on :8000
```

## Deploying to Vercel

```bash
vercel --prod          # first run creates the project and links it
vercel git connect https://github.com/dunsindata/HNG-Stage-1
```

`vercel.json` builds the dashboard (`npm run web:install && npm run web:build`),
serves `web/dist` as static output, and rewrites every `/api/*` request to the
serverless function in `api/index.js`. That file exports the Express app itself
as the handler, so the same `createApp` factory runs locally and in production.
`test/vercel.test.js` drives the function over a real socket, so a broken
deployment fails in the test suite rather than in production.

> **Storage is ephemeral on Vercel.** The function keeps SQLite in `/tmp`, the
> only writable directory there, and `/tmp` is per-instance and wiped when the
> instance recycles. Tasks therefore do not survive a cold start, and requests
> routed to a second instance see a different board. Set `TODO_DB_PATH` to
> hosted storage (Turso/libSQL keeps the same SQL, so it is a small change) when
> you need the list to persist.

## Run the tests

```bash
npm test                # 76 API + storage tests (node:test)
npm run web:test        # 47 UI tests (Vitest + Testing Library)
npm run web:typecheck   # tsc --noEmit
```

## Features

* Three task states — Not Started, In Progress and Completed — cycled from the
  card's status dot
* Optional description, priority (low/medium/high), due date and thumbnail
  (`http(s)` or site-relative URLs only)
* Donut charts of the per-state split, driven by `GET /api/stats`
* Sidebar views: high-priority work, everything, and per-state categories
* Search across titles and descriptions (case-insensitive, debounced)
* Due dates rendered as "Due today", "Overdue · Mar 4", highlighted in red
* Delete a single task, or clear everything completed at once
* Responsive layout, keyboard accessible with visible focus rings
* Errors from the API surface in an inline banner instead of failing silently

## API

| Method   | Path                         | Purpose                                                 |
| -------- | ---------------------------- | ------------------------------------------------------- |
| `GET`    | `/api/health`                | Service probe → `{"status": "ok"}`                      |
| `GET`    | `/api/stats`                 | Counts per state, for the donut charts                  |
| `GET`    | `/api/todos?filter=&q=`      | List tasks (`filter` = `all`\|`open`\|`not_started`\|`in_progress`\|`completed`) |
| `POST`   | `/api/todos`                 | Create a task                                           |
| `GET`    | `/api/todos/:id`             | Fetch one task                                          |
| `PATCH`  | `/api/todos/:id`             | Update `title`, `description`, `status`, `priority`, `due_date`, `image` |
| `DELETE` | `/api/todos/:id`             | Delete one task                                         |
| `POST`   | `/api/todos/clear-completed` | Delete every completed task                             |

Errors come back as `{"error": "message"}` with a `400` (invalid input),
`404` (unknown task) or `405` (wrong method) status. It is a normal JSON API,
so `curl` works too:

```bash
curl -X POST http://127.0.0.1:8000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy milk", "priority": "high", "status": "in_progress", "due_date": "2031-01-01"}'
```

A task looks like this:

```json
{
  "id": 1,
  "title": "Buy milk",
  "description": "Two litres, semi-skimmed",
  "status": "in_progress",
  "priority": "high",
  "due_date": "2031-01-01",
  "image": null,
  "created_at": "2026-09-29T12:21:10Z",
  "updated_at": "2026-09-29T12:21:10Z",
  "completed_at": null
}
```

> `completed` (a boolean) was replaced by `status`, and `description` and `image`
> were added. An existing `data/todos.db` is upgraded in place on the next
> start: completed tasks become `"completed"`, everything else
> `"not_started"`. The old `?status=` query parameter is now `?filter=`.

## Project layout

```
src/store.js          SQLite storage, v1→v2 migration, validation (node:sqlite)
src/app.js            Express app factory: JSON API at /api, static files at /
src/index.js          CLI entry point: flags, listen, graceful shutdown
public/               No-build front-end served by `npm start` by default
web/src/App.tsx       React root: the dashboard shell and its sidebar views
web/src/useTodos.ts   All task state: list, counts, filter, search, mutations
web/src/api.ts        Typed API client with error mapping
web/src/types.ts      Todo / Stats / draft / patch shapes
web/src/lib/dates.ts  Date wording ("Due today", "2 days ago", "29/9/2026")
web/src/lib/labels.ts Status and priority labels, and the state cycle
web/src/components/   Sidebar, Topbar, WelcomeBar, TaskCard, StatusPanel, ...
web/vite.config.ts    Vite config, /api dev proxy, Vitest config
test/store.test.js    Storage, validation and migration tests
test/api.test.js      End-to-end HTTP tests against a live server
web/src/*.test.tsx    UI tests (Vitest + Testing Library)
```

## How it works

* **Layering.** `src/store.js` owns persistence and validation, `src/app.js`
  only translates HTTP ⇄ store calls, and the browser only talks to the API.
  One set of validation rules therefore applies to the UI and to `curl`.
* **Shape.** `createApp(store)` returns an Express app without binding a port,
  so tests import the same app they would deploy and add their own store.
* **Concurrency.** `node:sqlite` is synchronous, and Node runs the handlers on
  one thread, so writes cannot interleave — no locking layer is needed.
* **Safety.** Titles are rendered with `textContent`, never `innerHTML`, so a
  task called `<script>…</script>` is shown literally. SQL uses bound
  parameters, search terms escape `LIKE` wildcards, the JSON body is capped at
  64 KB, and `express.static` cannot escape `public/`.
* **Ordering.** Open tasks come first, then newest first (a stable tie-break on
  id keeps it deterministic).

### Design notes / assumptions

* Single-user, local-first tool: no accounts, auth, or multi-user sync. Binding
  to `0.0.0.0` shares the list with everyone on your network, so only do that
  on a trusted one.
* Deleting prompts for confirmation rather than offering undo.
* A body above the size limit is answered with `400` (not `413`) to keep every
  validation failure in one response shape; a purist REST API would use `413`.
* `created_at`/`updated_at` use second resolution, so a task created and edited
  within the same second shows identical timestamps.

### If `npm` is blocked in PowerShell

Windows PowerShell's default execution policy refuses to run `npm.ps1`:

```
npm : File ...\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

Three ways around it, in order of convenience:

1. Set the policy for your user only (no admin needed, easily reverted):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
2. Use `npm.cmd` explicitly: `npm.cmd install`, `npm.cmd test`.
3. Run the commands from `cmd.exe` or Git Bash, where `npm` resolves to
   `npm.cmd` and the policy does not apply.

