"use client";

import { useState } from "react";

type Repository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
};

type RepositoriesResponse = {
  repositories?: Repository[];
  error?: string;
};

export default function ConnectRepositoryForm() {
  const [showForm, setShowForm] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadRepositories() {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/github/repositories", {
        method: "GET",
      });
      const data = (await response.json()) as RepositoriesResponse;

      if (!response.ok) {
        setMessage(data.error ?? "Failed to load repositories.");
        setRepositories([]);
        return;
      }

      const fetchedRepositories = data.repositories ?? [];
      setRepositories(fetchedRepositories);

      if (fetchedRepositories.length > 0) {
        setSelectedRepo(fetchedRepositories[0].fullName);
      }
    } catch {
      setMessage("Request failed. Please try again.");
      setRepositories([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggle() {
    const nextShowState = !showForm;
    setShowForm(nextShowState);
    setMessage(null);

    if (nextShowState && repositories.length === 0) {
      await loadRepositories();
    }
  }

  function handleConnect() {
    if (!selectedRepo) {
      setMessage("Select a repository first.");
      return;
    }

    setMessage(`Connected to ${selectedRepo} (no-op for now).`);
  }

  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
      >
        {showForm ? "Hide repository list" : "Connect repository"}
      </button>

      {showForm ? (
        <div className="mt-4 space-y-4 text-left">
          <button
            type="button"
            onClick={loadRepositories}
            disabled={isLoading}
            className="w-full rounded-xl border border-white/15 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Loading repositories..." : "Refresh repository list"}
          </button>

          <div>
            <label
              htmlFor="repo-select"
              className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-300"
            >
              Select repository
            </label>
            <select
              id="repo-select"
              value={selectedRepo}
              onChange={(event) => setSelectedRepo(event.target.value)}
              className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 focus:ring-2"
            >
              {repositories.length === 0 ? (
                <option value="">No repositories found</option>
              ) : (
                repositories.map((repo) => (
                  <option key={repo.id} value={repo.fullName}>
                    {repo.fullName} {repo.private ? "(private)" : "(public)"}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={repositories.length === 0}
            className="w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            Connect
          </button>

          {message ? <p className="text-sm text-zinc-200">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
