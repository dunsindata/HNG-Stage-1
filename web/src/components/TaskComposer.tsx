import { useState, type FormEvent } from "react";

import type { Priority, TodoDraft } from "../types";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "low", label: "Low priority" },
  { value: "medium", label: "Medium priority" },
  { value: "high", label: "High priority" },
];

interface TaskComposerProps {
  onAdd: (draft: TodoDraft) => Promise<boolean>;
  onError: (message: string) => void;
}

export function TaskComposer({ onAdd, onError }: TaskComposerProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      onError("Enter a task title first.");
      return;
    }

    setIsSaving(true);
    const created = await onAdd({ title: trimmed, priority, due_date: dueDate || null });
    setIsSaving(false);

    // Only clear the fields once the server has accepted the task, so a failed
    // request does not throw away what the user typed.
    if (created) {
      setTitle("");
      setPriority("medium");
      setDueDate("");
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit} autoComplete="off">
      <input
        className="composer__title"
        type="text"
        maxLength={200}
        placeholder="What needs doing?"
        aria-label="Task title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <select
        className="composer__field"
        aria-label="Priority"
        value={priority}
        onChange={(event) => setPriority(event.target.value as Priority)}
      >
        {PRIORITIES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        className="composer__field"
        type="date"
        aria-label="Due date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
      />
      <button type="submit" className="primary-button" disabled={isSaving}>
        {isSaving ? "Adding…" : "Add task"}
      </button>
    </form>
  );
}
