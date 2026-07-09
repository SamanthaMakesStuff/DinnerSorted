"use client";

/**
 * Always-available zero-effort backup meals. Shown regardless of the plan,
 * with neutral, guilt-free framing — these are always a fine choice.
 */
import { useStore } from "@/lib/store";

export function EmergencyMeals() {
  const { data } = useStore();
  const meals = data.preferences.emergencyMeals.filter((m) => m.trim() !== "");
  if (meals.length === 0) return null;

  return (
    <section aria-labelledby="emergency-heading" className="card">
      <h2 id="emergency-heading" style={{ marginTop: 0 }}>
        Always fine, zero effort
      </h2>
      <p className="muted" style={{ marginTop: 0 }}>
        These need no plan and no energy. Picking one of these is a completely
        valid dinner.
      </p>
      <ul>
        {meals.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </section>
  );
}
