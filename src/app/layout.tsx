import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { accountsEnabled, getSessionUser } from "@/lib/session";
import { Nav } from "@/components/Nav";
import { DisplaySettings } from "@/components/DisplaySettings";

export const metadata: Metadata = {
  title: {
    default: "DinnerSorted",
    template: "%s — DinnerSorted",
  },
  description:
    "A weekly meal planner that removes decision fatigue — built for neurodivergent and disabled people.",
};

/**
 * Applies saved display settings (theme, font, text size) before first paint
 * so there's no flash of the wrong theme. Display settings are not medical
 * data, so localStorage is fine for them.
 */
const displaySettingsScript = `
(function () {
  try {
    var root = document.documentElement;
    root.setAttribute("data-theme", localStorage.getItem("ds-theme") || "auto");
    root.setAttribute("data-font", localStorage.getItem("ds-font") || "default");
    root.setAttribute("data-size", localStorage.getItem("ds-size") || "normal");
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <html lang="en-GB" data-theme="auto" data-font="default" data-size="normal">
      <head>
        <script dangerouslySetInnerHTML={{ __html: displaySettingsScript }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <a href="/" className="site-title">
              DinnerSorted
            </a>
            <Nav signedIn={user != null} accountsAvailable={accountsEnabled()} />
            <DisplaySettings />
          </div>
        </header>
        <StoreProvider signedIn={user != null}>
          <main id="main">{children}</main>
        </StoreProvider>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>
              DinnerSorted stores only what it needs to plan your meals. Guest
              data lives in this browser tab only and is gone when you close
              it — use <a href="/data">Download my data</a> to keep a backup.
              Nothing here counts calories, sets goals, or judges what you eat.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
