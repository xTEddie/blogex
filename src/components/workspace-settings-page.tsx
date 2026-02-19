"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CONNECT_SESSION_KEY, CONNECT_SESSION_TTL_MS } from "@/lib/connect-session";

type PersistedConnectState = {
  selectedRepo?: string;
  selectedBranch?: string;
  updatedAt: number;
};

type BlogexConfig = {
  owner: string;
  targetRepo: string;
  targetBranch: string;
  targetDirectory: string;
};

type GetConfigResponse = {
  exists?: boolean;
  config?: Partial<BlogexConfig> | null;
  error?: string;
};

type SaveConfigResponse = {
  success?: boolean;
  error?: string;
};

type SyncFile = {
  name: string;
  path: string;
  size: number;
};

type SyncListResponse = {
  files?: SyncFile[];
  error?: string;
};

type SyncPullResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

const DEFAULT_CONFIG: BlogexConfig = {
  owner: "",
  targetRepo: "",
  targetBranch: "",
  targetDirectory: "",
};

export default function WorkspaceSettingsPage() {
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("");
  const [config, setConfig] = useState<BlogexConfig>(DEFAULT_CONFIG);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syncFiles, setSyncFiles] = useState<SyncFile[]>([]);
  const [selectedSyncPath, setSelectedSyncPath] = useState("");
  const [showSyncList, setShowSyncList] = useState(false);
  const [isLoadingSyncFiles, setIsLoadingSyncFiles] = useState(false);
  const [isSyncingFile, setIsSyncingFile] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function loadConfig(nextRepo: string, nextBranch: string) {
    if (!nextRepo || !nextBranch) {
      setMessage("Set repository and branch first.");
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/github/repositories/config?repo=${encodeURIComponent(nextRepo)}&branch=${encodeURIComponent(nextBranch)}`,
      );
      const data = (await response.json()) as GetConfigResponse;

      if (!response.ok) {
        setMessage(data.error ?? "Failed to load blogex.config.json.");
        return;
      }

      if (!data.exists || !data.config) {
        setConfig(DEFAULT_CONFIG);
        setMessage("No blogex.config.json found yet. Save to create it.");
        return;
      }

      setConfig({
        owner: data.config.owner ?? "",
        targetRepo: data.config.targetRepo ?? "",
        targetBranch: data.config.targetBranch ?? "",
        targetDirectory: data.config.targetDirectory ?? "",
      });
      setMessage("Configuration loaded.");
    } catch {
      setMessage("Request failed while loading config.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CONNECT_SESSION_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedConnectState;
      const isExpired =
        !parsed.updatedAt || Date.now() - parsed.updatedAt > CONNECT_SESSION_TTL_MS;

      if (isExpired || !parsed.selectedRepo || !parsed.selectedBranch) {
        return;
      }

      setRepo(parsed.selectedRepo);
      setBranch(parsed.selectedBranch);
      void loadConfig(parsed.selectedRepo, parsed.selectedBranch);
    } catch {
      setMessage("Could not restore workspace session.");
    }
  }, []);

  async function handleLoad() {
    await loadConfig(repo.trim(), branch.trim());
  }

  async function handleSave() {
    const trimmedRepo = repo.trim();
    const trimmedBranch = branch.trim();

    if (!trimmedRepo || !trimmedBranch) {
      setMessage("Repository and branch are required.");
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/github/repositories/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: trimmedRepo,
          branch: trimmedBranch,
          config,
        }),
      });

      const data = (await response.json()) as SaveConfigResponse;
      if (!response.ok) {
        setMessage(data.error ?? "Failed to save blogex.config.json.");
        return;
      }

      setMessage("blogex.config.json saved.");
    } catch {
      setMessage("Request failed while saving config.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLoadSyncFiles() {
    const sourceRepo = config.targetRepo.trim();
    const sourceBranch = config.targetBranch.trim();
    const sourceDirectory = config.targetDirectory.trim() || "_posts";

    if (!sourceRepo || !sourceBranch) {
      setSyncMessage("Set Target Repo and Target Branch first.");
      return;
    }

    setIsLoadingSyncFiles(true);
    setShowSyncList(true);
    setSyncMessage(null);

    try {
      const response = await fetch(
        `/api/github/repositories/sync?sourceRepo=${encodeURIComponent(sourceRepo)}&sourceBranch=${encodeURIComponent(sourceBranch)}&sourceDirectory=${encodeURIComponent(sourceDirectory)}`,
      );
      const data = (await response.json()) as SyncListResponse;

      if (!response.ok) {
        setSyncFiles([]);
        setSelectedSyncPath("");
        setSyncMessage(data.error ?? "Failed to load sync markdown files.");
        return;
      }

      const files = data.files ?? [];
      setSyncFiles(files);
      setSelectedSyncPath(files[0]?.path ?? "");
      setSyncMessage(files.length === 0 ? "No markdown files found." : null);
    } catch {
      setSyncFiles([]);
      setSelectedSyncPath("");
      setSyncMessage("Request failed while loading sync markdown files.");
    } finally {
      setIsLoadingSyncFiles(false);
    }
  }

  async function handleSyncSelectedMarkdown() {
    const sourceRepo = config.targetRepo.trim();
    const sourceBranch = config.targetBranch.trim();
    const sourceDirectory = config.targetDirectory.trim() || "_posts";
    const targetRepo = repo.trim();
    const targetBranch = branch.trim();

    if (!selectedSyncPath) {
      setSyncMessage("Select one markdown file to sync.");
      return;
    }

    if (!sourceRepo || !sourceBranch || !targetRepo || !targetBranch) {
      setSyncMessage("Source and target repo/branch values are required.");
      return;
    }

    setIsSyncingFile(true);
    setSyncMessage(null);

    try {
      const response = await fetch("/api/github/repositories/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceRepo,
          sourceBranch,
          sourceDirectory,
          sourcePath: selectedSyncPath,
          targetRepo,
          targetBranch,
        }),
      });

      const data = (await response.json()) as SyncPullResponse;

      if (!response.ok) {
        setSyncMessage(data.error ?? "Failed to sync markdown.");
        return;
      }

      setSyncMessage(data.message ?? "Markdown synced successfully.");
    } catch {
      setSyncMessage("Request failed while syncing markdown.");
    } finally {
      setIsSyncingFile(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Workspace Settings
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/workspace"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 sm:text-sm"
            >
              Workspace
            </Link>
            <Link
              href="/user"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 sm:text-sm"
            >
              Back
            </Link>
          </div>
        </div>

        <p className="mt-2 text-sm text-zinc-300">
          Manage <code>blogex.config.json</code> for the selected repository and branch.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-200">
            Repository (owner/name)
            <input
              type="text"
              value={repo}
              onChange={(event) => setRepo(event.target.value)}
              placeholder="owner/repository"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
          </label>

          <label className="text-sm text-zinc-200">
            Branch
            <input
              type="text"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="main"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void handleLoad()}
            disabled={isLoading}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "Load config"}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-xl border border-white/15 bg-white/95 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save config"}
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-200">
            Owner
            <input
              type="text"
              value={config.owner}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, owner: event.target.value }))
              }
              placeholder="xTEddie"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
          </label>

          <label className="text-sm text-zinc-200">
            Target Repo
            <input
              type="text"
              value={config.targetRepo}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, targetRepo: event.target.value }))
              }
              placeholder="owner/target-repository"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
          </label>

          <label className="text-sm text-zinc-200">
            Target Branch
            <input
              type="text"
              value={config.targetBranch}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, targetBranch: event.target.value }))
              }
              placeholder="main"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
          </label>

          <label className="text-sm text-zinc-200">
            Target Directory
            <input
              type="text"
              value={config.targetDirectory}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, targetDirectory: event.target.value }))
              }
              placeholder="_posts"
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
          </label>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-zinc-200">
            {message}
          </p>
        ) : null}

        <div className="mt-8 rounded-xl border border-white/15 bg-zinc-900/50 p-4 sm:p-5">
          <h2 className="text-base font-semibold text-white">Sync markdowns</h2>
          <p className="mt-1 text-sm text-zinc-300">
            Pull one markdown file from configured target repo into this repo&apos;s
            <code> _posts</code> directory.
          </p>

          <div className="mt-4">
            <button
              type="button"
              onClick={() => void handleLoadSyncFiles()}
              disabled={isLoadingSyncFiles}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingSyncFiles ? "Loading markdowns..." : "Load markdowns to sync"}
            </button>
          </div>

          {showSyncList ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
                Source markdown files
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
                {isLoadingSyncFiles ? (
                  <p className="px-3 py-2 text-sm text-zinc-300">Loading...</p>
                ) : syncFiles.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-zinc-300">No markdown files available.</p>
                ) : (
                  syncFiles.map((file) => {
                    const isSelected = selectedSyncPath === file.path;

                    return (
                      <button
                        key={file.path}
                        type="button"
                        onClick={() => setSelectedSyncPath(file.path)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          isSelected
                            ? "border-white/45 bg-white/15 text-white"
                            : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                        }`}
                      >
                        <span className="truncate pr-3">{file.path}</span>
                        <span className="shrink-0 text-[11px] text-zinc-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleSyncSelectedMarkdown()}
                disabled={isSyncingFile || !selectedSyncPath || syncFiles.length === 0}
                className="mt-4 rounded-xl border border-white/15 bg-white/95 px-4 py-2.5 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSyncingFile ? "Syncing..." : "Pull selected markdown"}
              </button>
            </div>
          ) : null}

          {syncMessage ? (
            <p className="mt-4 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-zinc-200">
              {syncMessage}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
