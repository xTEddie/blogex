import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import CreateRepositoryForm from "@/components/create-repository-form";
import { getGithubUser } from "@/lib/github-user";

export default async function UserPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("gh_oauth_token")?.value;

  if (!token) {
    redirect("/");
  }

  const user = await getGithubUser(token);

  if (!user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/30">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Welcome, {user.name ?? user.login}
        </h1>
        <CreateRepositoryForm />
        <Link
          href="/workspace"
          className="mt-5 block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
        >
          Open Workspace
        </Link>
        <form action="/api/auth/logout" method="post" className="mt-8">
          <button
            type="submit"
            className="w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
          >
            Log out
          </button>
        </form>
      </section>
    </main>
  );
}
