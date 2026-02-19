export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1f2937_0%,#09090b_45%,#020617_100%)]" />

      <section className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-300">
          blogex
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Sign in with GitHub
        </h1>
        <p className="mt-2 text-sm text-zinc-300">
          Use your GitHub account to continue.
        </p>

        <form
          className="mt-8"
          action="/api/auth/signin/github"
          method="post"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 fill-current"
            >
              <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.41-4.04-1.41-.55-1.4-1.34-1.78-1.34-1.78-1.1-.74.08-.72.08-.72 1.21.09 1.85 1.25 1.85 1.25 1.08 1.84 2.83 1.31 3.52 1 .11-.78.42-1.31.77-1.61-2.67-.3-5.47-1.33-5.47-5.95 0-1.31.47-2.39 1.24-3.24-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.24a11.4 11.4 0 0 1 6 0c2.29-1.56 3.29-1.24 3.29-1.24.67 1.65.25 2.87.13 3.17.77.85 1.23 1.93 1.23 3.24 0 4.63-2.81 5.65-5.49 5.94.43.38.82 1.12.82 2.27v3.37c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
            </svg>
            Continue with GitHub
          </button>
        </form>
      </section>
    </main>
  );
}
