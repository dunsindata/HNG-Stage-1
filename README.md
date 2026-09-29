# To-do list web app

A small, genuinely useful to-do list: add tasks, give them a priority and due
date, tick them off, edit them inline, search them, and clear what is finished.
Everything is stored in SQLite, so your list survives a restart.

**Stack:** Node.js + Express 5 for the API, the built-in `node:sqlite` module
for storage, and a dependency-free vanilla-JS front-end. Express is the only
production dependency, and the tests use Node's built-in test runner — so
`npm install` pulls in nothing extra.

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

| | `public/` (default) | `web/` (React + TypeScript) |
| --- | --- | --- |
| Build step | none | Vite + `tsc` |
| Served by | `npm start` directly | Vite dev server, or `npm start` after `npm run web:build` |
| Tests | covered through the API suite | 32 Vitest tests |

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

## Run the tests

```bash
npm test                # 77 API + storage tests (node:test)
npm run web:test        # 32 UI tests (Vitest + Testing Library)
npm run web:typecheck   # tsc --noEmit
```

## Features

* Add a task with an optional priority (low/medium/high) and due date
* Tick tasks complete, or click straight back to active
* Inline title editing — `Enter` saves, `Esc` cancels
* Delete a single task, or clear everything completed at once
* Filter by All / Active / Completed, with live counts
* Search titles (case-insensitive, debounced)
* Due dates rendered as "Due today", "Due tomorrow", "Overdue · Mar 4", and
  highlighted in red when overdue
* Dark, responsive layout; keyboard accessible with visible focus rings
* Errors from the API surface in an inline banner instead of failing silently

## API

| Method   | Path                         | Purpose                                              |
| -------- | ---------------------------- | ---------------------------------------------------- |
| `GET`    | `/api/health`                | Service probe → `{"status": "ok"}`                   |
| `GET`    | `/api/stats`                 | `{"total": n, "active": n, "completed": n}`           |
| `GET`    | `/api/todos?status=&q=`      | List tasks (`status` = `all`\|`active`\|`completed`)  |
| `POST`   | `/api/todos`                 | Create a task                                        |
| `GET`    | `/api/todos/:id`             | Fetch one task                                       |
| `PATCH`  | `/api/todos/:id`             | Update `title`, `completed`, `priority`, `due_date`   |
| `DELETE` | `/api/todos/:id`             | Delete one task                                      |
| `POST`   | `/api/todos/clear-completed` | Delete every completed task                          |

Errors come back as `{"error": "message"}` with a `400` (invalid input),
`404` (unknown task) or `405` (wrong method) status. It is a normal JSON API,
so `curl` works too:

```bash
curl -X POST http://127.0.0.1:8000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy milk", "priority": "high", "due_date": "2031-01-01"}'
```

A task looks like this:

```json
{
  "id": 1,
  "title": "Buy milk",
  "completed": false,
  "priority": "medium",
  "due_date": "2031-01-01",
  "created_at": "2026-09-29T12:21:10Z",
  "updated_at": "2026-09-29T12:21:10Z",
  "completed_at": null
}
```

## Project layout

```
src/store.js          SQLite storage + all validation rules (node:sqlite)
src/app.js            Express app factory: JSON API at /api, static files at /
src/index.js          CLI entry point: flags, listen, graceful shutdown
public/               No-build front-end served by `npm start` by default
web/src/App.tsx       React root: composes the page and holds the confirm dialogs
web/src/useTodos.ts   All task state: list, counts, filters, search, mutations
web/src/api.ts        Typed API client with error mapping
web/src/types.ts      Todo / Stats / draft / patch shapes
web/src/lib/dates.ts  Due-date wording ("Due today", "Overdue · Mar 4")
web/src/components/   Header, TaskComposer, Toolbar, TaskList, TaskItem, ...
web/vite.config.ts    Vite config, /api dev proxy, Vitest config
test/store.test.js    Storage and validation tests
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

