"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Repository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
};

type RepositoriesResponse = {
  repositories?: Repository[];
  page?: number;
  perPage?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  totalPages?: number | null;
  error?: string;
};

export default function ConnectRepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const filteredRepositories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return repositories;
    }

    return repositories.filter((repo) =>
      repo.fullName.toLowerCase().includes(query),
    );
  }, [repositories, searchQuery]);

  async function loadRepositories(targetPage: number) {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/github/repositories?page=${targetPage}&per_page=20`,
      );
      const data = (await response.json()) as RepositoriesResponse;

      if (!response.ok) {
        setRepositories([]);
        setMessage(data.error ?? "Failed to load repositories.");
        return;
      }

      const fetchedRepositories = data.repositories ?? [];
      const resolvedPage = data.page ?? targetPage;

      setRepositories(fetchedRepositories);
      setPage(resolvedPage);
      setTotalPages(data.totalPages ?? null);
      setHasNext(Boolean(data.hasNext));
      setHasPrev(Boolean(data.hasPrev));
      setSelectedRepo(
        fetchedRepositories.length > 0 ? fetchedRepositories[0].fullName : "",
      );
    } catch {
      setRepositories([]);
      setMessage("Request failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadRepositories(1);
  }, []);

  useEffect(() => {
    if (filteredRepositories.length === 0) {
      setSelectedRepo("");
      return;
    }

    if (!filteredRepositories.some((repo) => repo.fullName === selectedRepo)) {
      setSelectedRepo(filteredRepositories[0].fullName);
    }
  }, [filteredRepositories, selectedRepo]);

  function handleConnect() {
    if (!selectedRepo) {
      setMessage("Select a repository first.");
      return;
    }

    setMessage(`Connected to ${selectedRepo} (no-op for now).`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Connect repository
          </h1>
          <Link
            href="/user"
            className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 sm:text-sm"
          >
            Back
          </Link>
        </div>

        <p className="mt-2 text-sm text-zinc-300">
          Select a repository and click connect.
        </p>

        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
            Repository
          </p>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search repositories on this page"
            className="mb-3 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
          />
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
            {isLoading ? (
              <p className="px-3 py-2 text-sm text-zinc-300">
                Loading repositories...
              </p>
            ) : filteredRepositories.length === 0 ? (
              <p className="px-3 py-2 text-sm text-zinc-300">
                No repositories match your search
              </p>
            ) : (
              filteredRepositories.map((repo) => {
                const isSelected = selectedRepo === repo.fullName;

                return (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => setSelectedRepo(repo.fullName)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      isSelected
                        ? "border-white/45 bg-white/15 text-white"
                        : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate pr-3">{repo.fullName}</span>
                    <span className="shrink-0 rounded-full border border-white/15 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-300">
                      {repo.private ? "Private" : "Public"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => void loadRepositories(page - 1)}
            disabled={isLoading || !hasPrev}
            className="w-full rounded-xl border border-white/15 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => void loadRepositories(page + 1)}
            disabled={isLoading || !hasNext}
            className="w-full rounded-xl border border-white/15 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-400">
          Page {page}
          {totalPages ? ` of ${totalPages}` : ""}
        </p>

        <button
          type="button"
          onClick={handleConnect}
          disabled={isLoading || !selectedRepo}
          className="mt-6 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          Connect
        </button>

        {message ? <p className="mt-3 text-sm text-zinc-200">{message}</p> : null}
      </section>
    </main>
  );
}
