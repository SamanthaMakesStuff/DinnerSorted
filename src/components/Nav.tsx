"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE_ITEMS: { href: string; label: string }[] = [
  { href: "/", label: "This week" },
  { href: "/preferences", label: "Preferences" },
  { href: "/safe-meals", label: "Safe meals" },
  { href: "/plan", label: "Plan my week" },
  { href: "/shopping-list", label: "Shopping list" },
  { href: "/data", label: "Data & backup" },
];

export function Nav({
  signedIn,
  accountsAvailable,
}: {
  signedIn: boolean;
  accountsAvailable: boolean;
}) {
  const pathname = usePathname();
  const authHref = signedIn ? "/account" : "/login";

  return (
    <nav className="site-nav" aria-label="Main">
      <ul>
        {BASE_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
        {accountsAvailable && (
          <li>
            <Link
              href={authHref}
              aria-current={pathname === authHref ? "page" : undefined}
            >
              {signedIn ? "Account" : "Sign in"}
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
