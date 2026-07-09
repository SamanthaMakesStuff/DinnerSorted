import { redirect } from "next/navigation";
import { accountsEnabled, getSessionUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/account");
  const available = accountsEnabled();

  return (
    <>
      <h1>Sign in</h1>
      {!available ? (
        <p className="notice info">
          Accounts aren&rsquo;t switched on for this deployment, but everything
          still works: use DinnerSorted as a guest and keep your data with{" "}
          <a href="/data">Download my data</a> / Upload my data.
        </p>
      ) : (
        <>
          <p className="lede">
            Signing in keeps your preferences and meal history saved between
            visits, on any device.
          </p>
          <LoginForm />
          <p>
            No account yet? <a href="/register">Create one</a> — it takes a
            minute. Or keep using DinnerSorted{" "}
            <a href="/data">without an account</a>.
          </p>
        </>
      )}
    </>
  );
}
