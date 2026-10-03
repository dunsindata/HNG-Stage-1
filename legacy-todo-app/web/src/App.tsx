import { useEffect, useMemo, useState } from "react";

import { AddTaskModal } from "./components/AddTaskModal";
import { CompletedPanel } from "./components/CompletedPanel";
import { ErrorBanner } from "./components/ErrorBanner";
import { Sidebar } from "./components/Sidebar";
import { StatusPanel } from "./components/StatusPanel";
import { TodoBoard } from "./components/TodoBoard";
import { Topbar } from "./components/Topbar";
import { WelcomeBar } from "./components/WelcomeBar";
import { STATUS_LABELS, STATUS_ORDER } from "./lib/labels";
import { useTodos } from "./useTodos";
import type { TaskStatus, Todo, ViewKey } from "./types";

const USER = {
  name: "Sundar Gurung",
  email: "sundegurung80@gmail.com",
  initials: "SG",
};

const TEAM = [
  { name: "Asha Rai", initials: "AR" },
  { name: "Bikash Shrestha", initials: "BS" },
  { name: "Chandra Poudel", initials: "CP" },
  { name: "Deepa Karki", initials: "DK" },
];

type BoardView = Exclude<ViewKey, "settings" | "help">;

const EMPTY_HINTS: Record<ViewKey, string> = {
  dashboard: "Nothing on the board yet — add your first task.",
  vital: "No high-priority work outstanding.",
  mine: "No tasks yet — add your first one.",
  categories: "No tasks in this state yet.",
  settings: "",
  help: "",
};

const VIEW_TITLES: Record<ViewKey, string> = {
  dashboard: "To Do",
  vital: "Vital Task",
  mine: "My Task",
  categories: "Task Categories",
  settings: "Settings",
  help: "Help",
};

export function App() {
  const board = useTodos();
  const [view, setView] = useState<ViewKey>("dashboard");
  const [category, setCategory] = useState<TaskStatus>("not_started");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // The Categories view narrows on the server; every other view wants the lot.
  useEffect(() => {
    board.setFilter(view === "categories" ? category : "all");
  }, [view, category, board.setFilter]);

  const { open, done, vital } = useMemo(() => {
    const openTasks = board.todos.filter((todo) => todo.status !== "completed");
    return {
      open: openTasks,
      done: board.todos.filter((todo) => todo.status === "completed"),
      vital: openTasks.filter((todo) => todo.priority === "high"),
    };
  }, [board.todos]);

  const visible: Record<BoardView, Todo[]> = {
    dashboard: open,
    vital,
    mine: board.todos,
    categories: board.todos,
  };

  const isPlaceholder = view === "settings" || view === "help";

  function handleRemove(todo: Todo) {
    if (window.confirm(`Delete "${todo.title}"?`)) board.removeTodo(todo.id);
  }

  function handleClearCompleted() {
    if (window.confirm(`Delete ${board.stats.completed} completed task(s)?`)) {
      board.clearCompletedTasks();
    }
  }

  return (
    <div className="shell">
      <Sidebar
        user={USER}
        active={view}
        onNavigate={setView}
        onLogout={() => board.reportError("Logging out is not wired up in this demo.")}
      />

      <div className="main">
        <Topbar query={board.query} onQueryChange={board.setQuery} />

        <main className="content">
          <WelcomeBar
            firstName={USER.name.split(" ")[0] ?? USER.name}
            team={TEAM}
            onInvite={() => board.reportError("Invites are not wired up in this demo.")}
          />

          <ErrorBanner message={board.error} onDismiss={board.dismissError} />

          {isPlaceholder ? (
            <section className="panel">
              <header className="panel__header">
                <h2 className="panel__title">{VIEW_TITLES[view]}</h2>
              </header>
              <p className="panel__empty">
                {view === "settings"
                  ? "There is nothing to configure yet — every task is stored locally in SQLite."
                  : "Add a task with the Add Task button, then cycle its state by clicking the coloured dot."}
              </p>
            </section>
          ) : (
            <>
              {view === "categories" ? (
                <div className="tabs" role="group" aria-label="Task states">
                  {STATUS_ORDER.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="tab"
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {STATUS_LABELS[value]}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="board">
                <TodoBoard
                  title={view === "categories" ? STATUS_LABELS[category] : VIEW_TITLES[view]}
                  todos={visible[view as BoardView]}
                  isLoading={board.isLoading}
                  completedCount={board.stats.completed}
                  emptyHint={EMPTY_HINTS[view]}
                  onAdd={() => setIsAddOpen(true)}
                  onAdvanceStatus={board.setStatus}
                  onRemove={handleRemove}
                  onClearCompleted={handleClearCompleted}
                />

                <div className="board__side">
                  <StatusPanel stats={board.stats} />
                  <CompletedPanel todos={done} />
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {isAddOpen ? (
        <AddTaskModal
          onClose={() => setIsAddOpen(false)}
          onSubmit={board.addTodo}
          onError={board.reportError}
        />
      ) : null}
    </div>
  );
}
