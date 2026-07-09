"use client";

/**
 * Accessible tag/list editor: a text box + explicit "Add" button and a list
 * of removable items. No custom keyboard traps — Tab order is natural, every
 * remove button has an accessible name matching its visible context.
 */
import { useId, useState } from "react";

export function TagListInput({
  label,
  hint,
  values,
  onChange,
  addButtonLabel = "Add",
  placeholder,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  addButtonLabel?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setStatus(`“${v}” is already on the list.`);
      return;
    }
    onChange([...values, v]);
    setDraft("");
    setStatus(`Added “${v}”.`);
  }

  function remove(value: string) {
    onChange(values.filter((x) => x !== value));
    setStatus(`Removed “${value}”.`);
  }

  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint ? <span className="label-hint">{hint}</span> : null}
      </label>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          id={id}
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // add the tag instead of submitting the form
              add();
            }
          }}
          style={{ maxWidth: "18rem" }}
        />
        <button type="button" className="secondary small" onClick={add}>
          {addButtonLabel}
        </button>
      </div>
      {values.length > 0 && (
        <ul className="tag-list" aria-label={label}>
          {values.map((v) => (
            <li key={v}>
              <span>{v}</span>
              <button
                type="button"
                onClick={() => remove(v)}
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p aria-live="polite" className="visually-hidden">
        {status}
      </p>
    </div>
  );
}
