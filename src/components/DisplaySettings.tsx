"use client";

/**
 * Theme / font / text-size controls, shown in the header on every page.
 * Native <select>s so keyboard and voice-control behaviour comes for free;
 * visible label text matches accessible names for voice targeting.
 */
import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark" | "high-contrast";
type FontChoice = "default" | "dyslexia-friendly";
type SizeChoice = "normal" | "large" | "x-large";

function applySetting(attr: string, value: string, key: string) {
  document.documentElement.setAttribute(attr, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing etc. — setting still applies for this page view.
  }
}

export function DisplaySettings() {
  const [theme, setTheme] = useState<Theme>("auto");
  const [font, setFont] = useState<FontChoice>("default");
  const [size, setSize] = useState<SizeChoice>("normal");

  // Read what the pre-paint script applied.
  useEffect(() => {
    const root = document.documentElement;
    setTheme((root.getAttribute("data-theme") as Theme) || "auto");
    setFont((root.getAttribute("data-font") as FontChoice) || "default");
    setSize((root.getAttribute("data-size") as SizeChoice) || "normal");
  }, []);

  return (
    <div className="display-settings" role="group" aria-label="Display settings">
      <span>
        <label htmlFor="ds-theme">Theme</label>
        <select
          id="ds-theme"
          value={theme}
          onChange={(e) => {
            const v = e.target.value as Theme;
            setTheme(v);
            applySetting("data-theme", v, "ds-theme");
          }}
        >
          <option value="auto">Match device</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="high-contrast">High contrast</option>
        </select>
      </span>
      <span>
        <label htmlFor="ds-font">Font</label>
        <select
          id="ds-font"
          value={font}
          onChange={(e) => {
            const v = e.target.value as FontChoice;
            setFont(v);
            applySetting("data-font", v, "ds-font");
          }}
        >
          <option value="default">Standard</option>
          <option value="dyslexia-friendly">Dyslexia-friendly</option>
        </select>
      </span>
      <span>
        <label htmlFor="ds-size">Text size</label>
        <select
          id="ds-size"
          value={size}
          onChange={(e) => {
            const v = e.target.value as SizeChoice;
            setSize(v);
            applySetting("data-size", v, "ds-size");
          }}
        >
          <option value="normal">Normal</option>
          <option value="large">Large</option>
          <option value="x-large">Extra large</option>
        </select>
      </span>
    </div>
  );
}
