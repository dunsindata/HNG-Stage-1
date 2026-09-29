import { ErrorBanner } from "./components/ErrorBanner";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { TaskComposer } from "./components/TaskComposer";
import { TaskList } from "./components/TaskList";
import { Toolbar } from "./components/Toolbar";
import { useTodos } from "./useTodos";
import type { Todo } from "./types";

export function App() {
  const {
    todos,
    stats,
    status,
    query,
    isLoading,
    error,
    setStatus,
    setQuery,
    addTodo,
    toggleTodo,
    renameTodo,
    removeTodo,
    clearCompletedTasks,
    reportError,
    dismissError,
  } = useTodos();

  function handleRemove(todo: Todo) {
    if (window.confirm(`Delete "${todo.title}"?`)) removeTodo(todo.id);
  }

  function handleClearCompleted() {
    if (window.confirm(`Delete ${stats.completed} completed task(s)?`)) clearCompletedTasks();
  }

  return (
    <main className="app">
      <Header stats={stats} onClearCompleted={handleClearCompleted} />
      <TaskComposer onAdd={addTodo} onError={reportError} />
      <Toolbar
        status={status}
        stats={stats}
        query={query}
        onStatusChange={setStatus}
        onQueryChange={setQuery}
      />
      <ErrorBanner message={error} onDismiss={dismissError} />
      <TaskList
        todos={todos}
        isLoading={isLoading}
        status={status}
        query={query}
        onToggle={toggleTodo}
        onRename={renameTodo}
        onRemove={handleRemove}
      />
      <Footer />
    </main>
  );
}
