import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import CreateRepositoryForm from "@/components/create-repository-form";
import { OAUTH_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { APP_PATHS } from "@/lib/app-paths";
import { getGithubUser } from "@/lib/github-user";
import { STRINGS } from "@/lib/strings";

export default async function UserPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(OAUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    redirect(APP_PATHS.HOME);
  }

  const user = await getGithubUser(token);

  if (!user) {
    redirect(APP_PATHS.HOME);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/30">
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {STRINGS.user.welcome(user.name ?? user.login)}
        </h1>
        <CreateRepositoryForm />
        <Link
          href={APP_PATHS.WORKSPACE}
          className="mt-5 block w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
        >
          {STRINGS.user.openWorkspace}
        </Link>
        <form action={APP_PATHS.AUTH_LOGOUT} method="post" className="mt-8">
          <button
            type="submit"
            className="w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
          >
            {STRINGS.user.logout}
          </button>
        </form>
      </section>
    </main>
  );
}
