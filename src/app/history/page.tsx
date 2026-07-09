"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { resolvePlanMeal } from "@/lib/generation";
import { DAY_LABELS, MAX_PLAN_HISTORY, type WeekPlan } from "@/lib/types";
import { makeId } from "@/lib/defaults";

export default function HistoryPage() {
  const { data, update, ready } = useStore();
  const [status, setStatus] = useState("");

  if (!ready) return <p aria-live="polite">Loading your data…</p>;

  const history = data.planHistory;

  function repeat(plan: WeekPlan, description: string) {
    const clone: WeekPlan = {
      ...plan,
      id: makeId("plan"),
      createdAt: new Date().toISOString(),
      label: `Week of ${new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })} (repeat of ${plan.label})`,
      slots: plan.slots.map((s) => ({ ...s })),
    };
    update((d) => ({
      ...d,
      planHistory: [clone, ...d.planHistory].slice(0, MAX_PLAN_HISTORY),
    }));
    setStatus(`Done — ${description} is now this week's plan.`);
  }

  return (
    <>
      <h1>Past weeks</h1>
      <p className="lede">
        Every plan you&rsquo;ve made, newest first. “Use this week again”
        copies a past week exactly — same meals, same days.
      </p>

      <p aria-live="polite" role="status" className={status ? "notice info" : "visually-hidden"}>
        {status}
      </p>

      {history.length === 0 && (
        <p>
          Nothing here yet. <Link href="/plan">Plan your first week</Link> and
          it will be saved automatically.
        </p>
      )}

      {history.length > 1 && (
        <div className="button-row">
          <button type="button" onClick={() => repeat(history[1], history[1].label)}>
            Repeat last week
          </button>
        </div>
      )}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {history.map((plan, index) => (
          <li key={plan.id} className="card">
            <h2 style={{ margin: "0 0 0.3rem" }}>
              {plan.label}
              {index === 0 && (
                <>
                  {" "}
                  <span className="badge accent">current week</span>
                </>
              )}
            </h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Made {new Date(plan.createdAt).toLocaleDateString("en-GB")}
              {plan.estTotal != null && ` · estimated £${plan.estTotal.toFixed(2)}`}
            </p>
            <details>
              <summary>What was on the menu</summary>
              <ul>
                {plan.slots.map((slot) => {
                  const meal = slot.chosenId
                    ? resolvePlanMeal(data, slot.chosenId)
                    : null;
                  return (
                    <li key={slot.day}>
                      <strong>{DAY_LABELS[slot.day]}:</strong>{" "}
                      {meal?.name ?? (
                        <span className="muted">nothing picked</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
            {index > 0 && (
              <button
                type="button"
                className="secondary small"
                onClick={() => repeat(plan, plan.label)}
                aria-label={`Use ${plan.label} again this week`}
              >
                Use this week again
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
