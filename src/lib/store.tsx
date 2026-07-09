"use client";

/**
 * Client data store.
 *
 * Guest mode: data lives in sessionStorage ONLY (cleared when the tab
 * closes). Per the spec, medical/allergy data is never persisted client-side
 * beyond the session — the JSON export is the guest-mode backup mechanism.
 *
 * Signed in: data loads from and saves to /api/sync (debounced), stored
 * server-side in Postgres. If the server copy is empty on first sign-in, the
 * current session data is pushed up so nothing is lost.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { UserData } from "./types";
import { defaultUserData } from "./defaults";
import { userDataSchema } from "./schema";

const SESSION_KEY = "dinnersorted-session-data";

export type SyncState =
  | "guest" // not signed in — session-only storage
  | "loading" // fetching account data
  | "synced" // saved to account
  | "saving" // save in flight / queued
  | "error"; // last save failed

interface StoreContextValue {
  data: UserData;
  /** Replace the whole document (used by import/restore). */
  replaceData: (next: UserData) => void;
  /** Apply a partial update; updatedAt is maintained automatically. */
  update: (fn: (draft: UserData) => UserData) => void;
  syncState: SyncState;
  signedIn: boolean;
  /** True once initial load (session or server) has finished. */
  ready: boolean;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadFromSession(): UserData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = userDataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as UserData) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({
  children,
  signedIn,
}: {
  children: React.ReactNode;
  signedIn: boolean;
}) {
  const [data, setData] = useState<UserData>(() => defaultUserData());
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(
    signedIn ? "loading" : "guest"
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true); // don't save the initial load back

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const sessionData = loadFromSession();
      if (!signedIn) {
        if (sessionData) setData(sessionData);
        setSyncState("guest");
        setReady(true);
        return;
      }
      try {
        const res = await fetch("/api/sync", { method: "GET" });
        if (cancelled) return;
        if (res.ok) {
          const body = await res.json();
          if (body.data) {
            const parsed = userDataSchema.safeParse(body.data);
            if (parsed.success) {
              setData(parsed.data as UserData);
              setSyncState("synced");
              setReady(true);
              return;
            }
          }
          // No server data yet — adopt session data (first sign-in) or defaults.
          if (sessionData) {
            setData(sessionData);
            skipNextSave.current = false; // push it up
          }
          setSyncState("synced");
          setReady(true);
          return;
        }
        setSyncState("error");
        if (sessionData) setData(sessionData);
        setReady(true);
      } catch {
        if (!cancelled) {
          setSyncState("error");
          setReady(true);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // Persist on change (debounced).
  useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      // Session storage full/unavailable — export/import still works.
    }
    if (!signedIn) return;

    setSyncState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        setSyncState(res.ok ? "synced" : "error");
      } catch {
        setSyncState("error");
      }
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, ready, signedIn]);

  const update = useCallback((fn: (draft: UserData) => UserData) => {
    setData((prev) => ({ ...fn(prev), updatedAt: new Date().toISOString() }));
  }, []);

  const replaceData = useCallback((next: UserData) => {
    setData({ ...next, updatedAt: new Date().toISOString() });
  }, []);

  return (
    <StoreContext.Provider
      value={{ data, update, replaceData, syncState, signedIn, ready }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
