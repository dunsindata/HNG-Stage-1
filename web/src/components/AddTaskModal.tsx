import { useState, type FormEvent } from "react";

import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER, PRIORITY_ORDER } from "../lib/labels";
import type { Priority, TaskStatus, TodoDraft } from "../types";
import { IconClose } from "./Icons";

interface AddTaskModalProps {
  onClose: () => void;
  onSubmit: (draft: TodoDraft) => Promise<boolean>;
  onError: (message: string) => void;
}

export function AddTaskModal({ onClose, onSubmit, onError }: AddTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("not_started");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [image, setImage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      onError("Give the task a title first.");
      return;
    }

    setIsSaving(true);
    const created = await onSubmit({
      title: trimmed,
      description: description.trim() || null,
      status,
      priority,
      due_date: dueDate || null,
      image: image.trim() || null,
    });
    setIsSaving(false);
    if (created) onClose();
  }

  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-task-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <h2 className="modal__title" id="add-task-title">
            Add Task
          </h2>
          <button type="button" className="icon-button--ghost" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </header>

        <form className="modal__form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Title</span>
            <input
              className="field__input"
              type="text"
              maxLength={200}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              className="field__input field__input--area"
              rows={3}
              maxLength={1000}
              placeholder="Add the details…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span className="field__label">Status</span>
              <select
                className="field__input"
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
              >
                {STATUS_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Priority</span>
              <select
                className="field__input"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
              >
                {PRIORITY_ORDER.map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Due date</span>
              <input
                className="field__input"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Image URL</span>
            <input
              className="field__input"
              type="url"
              placeholder="https://… (optional thumbnail)"
              value={image}
              onChange={(event) => setImage(event.target.value)}
            />
          </label>

          <footer className="modal__footer">
            <button type="button" className="button--outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button--coral" disabled={isSaving}>
              {isSaving ? "Adding…" : "Add Task"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
