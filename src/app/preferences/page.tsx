import { Suspense } from "react";
import { PreferencesWizard } from "./PreferencesWizard";

export const metadata = { title: "Your preferences" };

export default function PreferencesPage() {
  return (
    <Suspense fallback={<p aria-live="polite">Loading your data…</p>}>
      <PreferencesWizard />
    </Suspense>
  );
}
