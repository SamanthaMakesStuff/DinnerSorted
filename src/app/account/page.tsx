import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { signOut } from "@/lib/auth";
import { DeleteAccount } from "./DeleteAccount";

export const metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <h1>Your account</h1>
      <p className="lede">
        Signed in as <strong>{user.email}</strong>. Your preferences, safe
        meals and history are saved to this account automatically as you use
        the app.
      </p>

      <section aria-labelledby="signout-heading">
        <h2 id="signout-heading">Sign out</h2>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="secondary">
            Sign out
          </button>
        </form>
      </section>

      <hr />

      <section aria-labelledby="backup-heading">
        <h2 id="backup-heading">Backups still work</h2>
        <p>
          Even with an account, you can <a href="/data">download your data</a>{" "}
          any time — useful as a backup or for moving away from DinnerSorted.
        </p>
      </section>

      <hr />

      <DeleteAccount />
    </>
  );
}
