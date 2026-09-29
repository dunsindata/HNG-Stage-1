"use strict";

/**
 * Front-end for the to-do list. Talks to the JSON API exposed by src/app.js and
 * renders the task list with plain DOM APIs (never innerHTML, so user supplied
 * titles can never be interpreted as markup).
 */

const API = {
  todos: "/api/todos",
  stats: "/api/stats",
};

const PRIORITY_LABELS = { low: "Low", medium: "Medium", high: "High" };
const SEARCH_DEBOUNCE_MS = 250;

const state = {
  todos: [],
  stats: { total: 0, active: 0, completed: 0 },
  status: "all",
  query: "",
  editingId: null,
  focusEditor: false,
};

const el = {
  form: document.getElementById("composer"),
  title: document.getElementById("title"),
  priority: document.getElementById("priority"),
  dueDate: document.getElementById("due-date"),
  search: document.getElementById("search"),
  filters: Array.from(document.querySelectorAll(".filter")),
  countBadges: Array.from(document.querySelectorAll("[data-count]")),
  list: document.getElementById("tasks"),
  empty: document.getElementById("empty"),
  summary: document.getElementById("summary"),
  alert: document.getElementById("alert"),
  clearCompleted: document.getElementById("clear-completed"),
  template: document.getElementById("task-template"),
};

// ------------------------------------------------------------------ transport

async function request(url, options = {}) {
  const init = { ...options };
  if (init.body !== undefined) {
    init.headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error("Could not reach the server — is it still running?");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && payload.error ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

// ------------------------------------------------------------------- data flow

async function fetchTodos() {
  const params = new URLSearchParams();
  if (state.status !== "all") params.set("status", state.status);
  if (state.query) params.set("q", state.query);
  const suffix = params.toString() ? `?${params}` : "";
  return request(`${API.todos}${suffix}`);
}

async function refreshData() {
  const [list, stats] = await Promise.all([fetchTodos(), request(API.stats)]);
  state.todos = list.todos;
  state.stats = stats;
}

/** Run an action, refresh the view, and surface any API error in the banner. */
async function run(action) {
  clearAlert();
  try {
    await action();
    render();
  } catch (error) {
    showAlert(error instanceof Error ? error.message : String(error));
  }
}

// ------------------------------------------------------------------ formatting

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatShortDate(date) {
  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
}

function describeDue(iso) {
  const due = parseIsoDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / DAY_MS);

  if (days === 0) return { text: "Due today", overdue: false };
  if (days === 1) return { text: "Due tomorrow", overdue: false };
  if (days === -1) return { text: "Due yesterday", overdue: true };
  if (days < 0) return { text: `Overdue · ${formatShortDate(due)}`, overdue: true };
  return { text: `Due ${formatShortDate(due)}`, overdue: false };
}

function emptyMessage() {
  if (state.query) return `No tasks match “${state.query}”.`;
  if (state.status === "active") return "Nothing left to do.";
  if (state.status === "completed") return "No completed tasks yet.";
  return "No tasks yet — add your first one above.";
}

// -------------------------------------------------------------------- rendering

function buildTask(todo) {
  const node = el.template.content.firstElementChild.cloneNode(true);
  node.dataset.id = String(todo.id);
  node.classList.toggle("is-completed", todo.completed);

  const toggle = node.querySelector(".task__toggle");
  toggle.checked = todo.completed;
  toggle.setAttribute(
    "aria-label",
    todo.completed ? `Mark "${todo.title}" as active` : `Mark "${todo.title}" as complete`,
  );

  const priorityBadge = node.querySelector(".badge--priority");
  priorityBadge.dataset.priority = todo.priority;
  priorityBadge.textContent = PRIORITY_LABELS[todo.priority] || todo.priority;

  const dueBadge = node.querySelector(".badge--due");
  if (todo.due_date) {
    const due = describeDue(todo.due_date);
    dueBadge.textContent = due.text;
    dueBadge.classList.toggle("is-overdue", due.overdue && !todo.completed);
    dueBadge.hidden = false;
  }

  const titleSlot = node.querySelector(".task__title");
  if (state.editingId === todo.id) {
    titleSlot.replaceWith(buildEditor(todo));
  } else {
    titleSlot.textContent = todo.title;
  }
  return node;
}

function buildEditor(todo) {
  const editor = document.createElement("input");
  editor.type = "text";
  editor.className = "task__editor";
  editor.maxLength = 200;
  editor.value = todo.title;
  editor.setAttribute("aria-label", "Edit task title");

  let settled = false;
  const finish = (save) => {
    if (settled) return;
    settled = true;
    if (save) {
      saveTitle(todo.id, editor.value);
    } else {
      state.editingId = null;
      state.focusEditor = false;
      render();
    }
  };

  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      // Settle before blurring so the blur handler cannot save a cancelled edit.
      finish(false);
      editor.blur();
    }
  });
  editor.addEventListener("blur", () => finish(true));
  return editor;
}

function render() {
  el.list.replaceChildren(...state.todos.map(buildTask));

  const isEmpty = state.todos.length === 0;
  el.empty.hidden = !isEmpty;
  if (isEmpty) el.empty.textContent = emptyMessage();

  for (const badge of el.countBadges) {
    badge.textContent = String(state.stats[badge.dataset.count] ?? 0);
  }
  for (const button of el.filters) {
    button.setAttribute("aria-pressed", String(button.dataset.status === state.status));
  }

  el.clearCompleted.disabled = state.stats.completed === 0;

  if (state.stats.total === 0) {
    el.summary.textContent = "No tasks yet.";
  } else {
    const { active, completed, total } = state.stats;
    el.summary.textContent = `${active} active · ${completed} completed · ${total} total`;
  }

  if (state.focusEditor) {
    state.focusEditor = false;
    const editor = el.list.querySelector(".task__editor");
    if (editor) {
      editor.focus();
      editor.select();
    }
  }
}

function showAlert(message) {
  el.alert.textContent = message;
  el.alert.hidden = false;
}

function clearAlert() {
  el.alert.textContent = "";
  el.alert.hidden = true;
}

// --------------------------------------------------------------------- actions

async function createTodo(event) {
  event.preventDefault();
  const title = el.title.value.trim();
  if (!title) {
    showAlert("Enter a task title first.");
    el.title.focus();
    return;
  }

  const payload = { title, priority: el.priority.value };
  if (el.dueDate.value) payload.due_date = el.dueDate.value;

  await run(async () => {
    await request(API.todos, { method: "POST", body: JSON.stringify(payload) });
    el.form.reset(); // only clear the inputs once the server accepted the task
    el.title.focus();
    await refreshData();
  });
}

async function toggleTodo(id, completed) {
  await run(async () => {
    await request(`${API.todos}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed }),
    });
    await refreshData();
  });
}

async function saveTitle(id, rawTitle) {
  const title = rawTitle.trim();
  const existing = state.todos.find((todo) => todo.id === id);
  state.editingId = null;
  state.focusEditor = false;

  if (!title) {
    render();
    showAlert("A task title cannot be empty.");
    return;
  }
  if (existing && existing.title === title) {
    render();
    return;
  }

  await run(async () => {
    await request(`${API.todos}/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
    await refreshData();
  });
}

async function removeTodo(id) {
  const existing = state.todos.find((todo) => todo.id === id);
  const label = existing ? `"${existing.title}"` : "this task";
  if (!window.confirm(`Delete ${label}?`)) return;

  await run(async () => {
    await request(`${API.todos}/${id}`, { method: "DELETE" });
    await refreshData();
  });
}

async function clearCompleted() {
  if (state.stats.completed === 0) return;
  if (!window.confirm(`Delete ${state.stats.completed} completed task(s)?`)) return;

  await run(async () => {
    await request(`${API.todos}/clear-completed`, { method: "POST" });
    await refreshData();
  });
}

function startEditing(id) {
  state.editingId = id;
  state.focusEditor = true;
  render();
}

function setStatus(status) {
  if (state.status === status) return;
  state.status = status;
  state.editingId = null;
  state.focusEditor = false;
  run(refreshData);
}

// ------------------------------------------------------------------ event wiring

el.form.addEventListener("submit", createTodo);

el.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const task = button.closest(".task");
  if (!task) return;

  const id = Number(task.dataset.id);
  if (button.dataset.action === "edit") {
    startEditing(id);
  } else if (button.dataset.action === "delete") {
    removeTodo(id);
  }
});

el.list.addEventListener("change", (event) => {
  const toggle = event.target.closest(".task__toggle");
  if (!toggle) return;
  const task = toggle.closest(".task");
  if (!task) return;
  toggleTodo(Number(task.dataset.id), toggle.checked);
});

for (const button of el.filters) {
  button.addEventListener("click", () => setStatus(button.dataset.status));
}

el.clearCompleted.addEventListener("click", clearCompleted);

let searchTimer = null;
el.search.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = el.search.value.trim();
    state.editingId = null;
    state.focusEditor = false;
    run(refreshData);
  }, SEARCH_DEBOUNCE_MS);
});

// -------------------------------------------------------------------- start-up

run(refreshData);
