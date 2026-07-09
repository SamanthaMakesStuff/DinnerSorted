import { redirect } from "next/navigation";
import { accountsEnabled, getSessionUser } from "@/lib/session";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/account");

  return (
    <>
      <h1>Create an account</h1>
      {!accountsEnabled() ? (
        <p className="notice info">
          Accounts aren&rsquo;t switched on for this deployment. You can still
          use everything as a guest — keep your data safe with{" "}
          <a href="/data">Download my data</a>.
        </p>
      ) : (
        <>
          <p className="lede">
            An account saves your preferences, safe meals and history so
            they&rsquo;re waiting for you next time — no files to manage. If
            you&rsquo;ve been using guest mode in this tab, your current data
            is kept and saved to the new account automatically.
          </p>
          <RegisterForm />
          <p>
            Prefer not to have an account? That&rsquo;s fine —{" "}
            <a href="/data">export/import</a> works forever and nothing is
            stored on a server.
          </p>
        </>
      )}
    </>
  );
}
