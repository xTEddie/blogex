"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Repository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
};

type Branch = {
  name: string;
};

type PostFile = {
  name: string;
  path: string;
  size: number;
};

type RepositoriesResponse = {
  repositories?: Repository[];
  page?: number;
  perPage?: number;
  totalPages?: number | null;
  error?: string;
};

type BranchesResponse = {
  branches?: Branch[];
  error?: string;
};

type PostFilesResponse = {
  files?: PostFile[];
  error?: string;
};

type MarkdownContentResponse = {
  name?: string;
  path?: string;
  markdown?: string;
  error?: string;
};

type SaveMarkdownResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export default function ConnectRepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [postFiles, setPostFiles] = useState<PostFile[]>([]);

  const [selectedRepo, setSelectedRepo] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedPostPath, setSelectedPostPath] = useState("");
  const [selectedPostName, setSelectedPostName] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [editorContent, setEditorContent] = useState("");

  const [step, setStep] = useState<"repository" | "branch" | "explorer">(
    "repository",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(true);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
  const [isSavingMarkdown, setIsSavingMarkdown] = useState(false);

  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [branchSearchQuery, setBranchSearchQuery] = useState("");
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [totalPages, setTotalPages] = useState<number | null>(null);

  const filteredRepositories = useMemo(() => {
    const query = repoSearchQuery.trim().toLowerCase();
    if (!query) {
      return repositories;
    }
    return repositories.filter((repo) =>
      repo.fullName.toLowerCase().includes(query),
    );
  }, [repositories, repoSearchQuery]);

  const filteredBranches = useMemo(() => {
    const query = branchSearchQuery.trim().toLowerCase();
    if (!query) {
      return branches;
    }
    return branches.filter((branch) =>
      branch.name.toLowerCase().includes(query),
    );
  }, [branches, branchSearchQuery]);

  const filteredPostFiles = useMemo(() => {
    const query = postSearchQuery.trim().toLowerCase();
    if (!query) {
      return postFiles;
    }
    return postFiles.filter((file) => file.name.toLowerCase().includes(query));
  }, [postFiles, postSearchQuery]);

  async function loadAllRepositories() {
    setIsLoadingRepositories(true);
    setMessage(null);

    try {
      const allRepositories: Repository[] = [];
      let currentPage = 1;
      let hasNext = true;
      let resolvedTotalPages: number | null = null;

      while (hasNext) {
        const response = await fetch(
          `/api/github/repositories?page=${currentPage}&per_page=100`,
        );
        const data = (await response.json()) as RepositoriesResponse;

        if (!response.ok) {
          setMessage(data.error ?? "Failed to load repositories.");
          setRepositories([]);
          return;
        }

        allRepositories.push(...(data.repositories ?? []));
        resolvedTotalPages = data.totalPages ?? resolvedTotalPages;

        const pageFromResponse = data.page ?? currentPage;
        const perPage = data.perPage ?? 100;
        hasNext =
          resolvedTotalPages !== null
            ? pageFromResponse < resolvedTotalPages
            : (data.repositories?.length ?? 0) === perPage;
        currentPage += 1;
      }

      setRepositories(allRepositories);
      setTotalPages(resolvedTotalPages);
      setSelectedRepo(
        allRepositories.length > 0 ? allRepositories[0].fullName : "",
      );
      setStep("repository");
      setBranches([]);
      setPostFiles([]);
      setSelectedBranch("");
      setSelectedPostPath("");
      setSelectedPostName("");
      setMarkdownContent("");
      setEditorContent("");
    } catch {
      setRepositories([]);
      setMessage("Request failed while loading repositories.");
    } finally {
      setIsLoadingRepositories(false);
    }
  }

  async function loadBranches(repoFullName: string) {
    setIsLoadingBranches(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/github/repositories/branches?repo=${encodeURIComponent(repoFullName)}`,
      );
      const data = (await response.json()) as BranchesResponse;

      if (!response.ok) {
        setMessage(data.error ?? "Failed to load branches.");
        setBranches([]);
        return false;
      }

      const fetchedBranches = data.branches ?? [];
      setBranches(fetchedBranches);
      setSelectedBranch(fetchedBranches.length > 0 ? fetchedBranches[0].name : "");
      return true;
    } catch {
      setBranches([]);
      setMessage("Request failed while loading branches.");
      return false;
    } finally {
      setIsLoadingBranches(false);
    }
  }

  async function loadPostFiles(repoFullName: string, branchName: string) {
    setIsLoadingPosts(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/github/repositories/posts?repo=${encodeURIComponent(repoFullName)}&branch=${encodeURIComponent(branchName)}`,
      );
      const data = (await response.json()) as PostFilesResponse;

      if (!response.ok) {
        setMessage(data.error ?? "Failed to load markdown files.");
        setPostFiles([]);
        return null;
      }

      const fetchedFiles = data.files ?? [];
      setPostFiles(fetchedFiles);
      setSelectedPostPath(fetchedFiles.length > 0 ? fetchedFiles[0].path : "");
      setSelectedPostName(fetchedFiles.length > 0 ? fetchedFiles[0].name : "");
      return fetchedFiles;
    } catch {
      setPostFiles([]);
      setMessage("Request failed while loading markdown files.");
      return null;
    } finally {
      setIsLoadingPosts(false);
    }
  }

  async function loadMarkdownFile(
    repoFullName: string,
    branchName: string,
    filePath: string,
  ) {
    setIsLoadingMarkdown(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/github/repositories/posts/content?repo=${encodeURIComponent(repoFullName)}&branch=${encodeURIComponent(branchName)}&path=${encodeURIComponent(filePath)}`,
      );
      const data = (await response.json()) as MarkdownContentResponse;

      if (!response.ok) {
        setMessage(data.error ?? "Failed to load markdown content.");
        setMarkdownContent("");
        return;
      }

      setMarkdownContent(data.markdown ?? "");
      setEditorContent(data.markdown ?? "");
      setSelectedPostPath(data.path ?? filePath);
      setSelectedPostName(data.name ?? filePath.split("/").pop() ?? filePath);
    } catch {
      setMessage("Request failed while loading markdown content.");
      setMarkdownContent("");
      setEditorContent("");
    } finally {
      setIsLoadingMarkdown(false);
    }
  }

  useEffect(() => {
    void loadAllRepositories();
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

  useEffect(() => {
    if (filteredBranches.length === 0) {
      setSelectedBranch("");
      return;
    }

    if (!filteredBranches.some((branch) => branch.name === selectedBranch)) {
      setSelectedBranch(filteredBranches[0].name);
    }
  }, [filteredBranches, selectedBranch]);

  useEffect(() => {
    if (filteredPostFiles.length === 0) {
      setSelectedPostPath("");
      return;
    }

    if (!filteredPostFiles.some((file) => file.path === selectedPostPath)) {
      setSelectedPostPath(filteredPostFiles[0].path);
    }
  }, [filteredPostFiles, selectedPostPath]);

  async function handleNextToBranches() {
    if (!selectedRepo) {
      setMessage("Select a repository first.");
      return;
    }

    const ok = await loadBranches(selectedRepo);
    if (ok) {
      setStep("branch");
    }
  }

  async function handleConnectToExplorer() {
    if (!selectedRepo || !selectedBranch) {
      setMessage("Select a repository and branch first.");
      return;
    }

    const loadedFiles = await loadPostFiles(selectedRepo, selectedBranch);
    if (!loadedFiles) {
      return;
    }

    if (loadedFiles.length > 0) {
      await loadMarkdownFile(selectedRepo, selectedBranch, loadedFiles[0].path);
    } else {
      setMarkdownContent("");
      setEditorContent("");
    }

    setStep("explorer");
  }

  async function handleOpenFile(file: PostFile) {
    if (!selectedRepo || !selectedBranch) {
      setMessage("Repository or branch is not selected.");
      return;
    }

    await loadMarkdownFile(selectedRepo, selectedBranch, file.path);
  }

  async function handleSaveMarkdown() {
    if (!selectedRepo || !selectedBranch || !selectedPostPath) {
      setMessage("Select a markdown file before saving.");
      return;
    }

    setIsSavingMarkdown(true);
    setMessage(null);

    try {
      const response = await fetch("/api/github/repositories/posts/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repo: selectedRepo,
          branch: selectedBranch,
          path: selectedPostPath,
          markdown: editorContent,
          message: `chore: update ${selectedPostName}`,
        }),
      });

      const data = (await response.json()) as SaveMarkdownResponse;
      if (!response.ok) {
        setMessage(data.error ?? "Failed to save markdown file.");
        return;
      }

      setMarkdownContent(editorContent);
      setMessage(data.message ?? "Saved successfully.");
    } catch {
      setMessage("Request failed while saving markdown file.");
    } finally {
      setIsSavingMarkdown(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-8">
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
          {step === "repository"
            ? "Select a repository."
            : step === "branch"
              ? "Select a branch."
              : "Browse markdown files in _posts."}
        </p>

        {step === "repository" ? (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
              Repository
            </p>
            <input
              type="text"
              value={repoSearchQuery}
              onChange={(event) => setRepoSearchQuery(event.target.value)}
              placeholder="Search repositories"
              className="mb-3 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
              {isLoadingRepositories ? (
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
            <p className="mt-4 text-xs text-zinc-400">
              Loaded {repositories.length} repositories
              {totalPages ? ` across ${totalPages} pages` : ""}.
            </p>
            <button
              type="button"
              onClick={() => void handleNextToBranches()}
              disabled={isLoadingRepositories || !selectedRepo || isLoadingBranches}
              className="mt-6 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoadingBranches ? "Loading branches..." : "Next"}
            </button>
          </div>
        ) : null}

        {step === "branch" ? (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-300">
                Branch
              </p>
              <button
                type="button"
                onClick={() => setStep("repository")}
                className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15"
              >
                Change repo
              </button>
            </div>
            <p className="mb-3 text-xs text-zinc-400">Selected: {selectedRepo}</p>
            <input
              type="text"
              value={branchSearchQuery}
              onChange={(event) => setBranchSearchQuery(event.target.value)}
              placeholder="Search branches"
              className="mb-3 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
            />
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
              {isLoadingBranches ? (
                <p className="px-3 py-2 text-sm text-zinc-300">Loading branches...</p>
              ) : filteredBranches.length === 0 ? (
                <p className="px-3 py-2 text-sm text-zinc-300">
                  No branches match your search
                </p>
              ) : (
                filteredBranches.map((branch) => {
                  const isSelected = selectedBranch === branch.name;

                  return (
                    <button
                      key={branch.name}
                      type="button"
                      onClick={() => setSelectedBranch(branch.name)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                        isSelected
                          ? "border-white/45 bg-white/15 text-white"
                          : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <span className="truncate pr-3">{branch.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleConnectToExplorer()}
              disabled={isLoadingBranches || !selectedBranch || isLoadingPosts}
              className="mt-6 w-full rounded-xl border border-white/15 bg-white/95 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoadingPosts ? "Loading _posts..." : "Connect"}
            </button>
          </div>
        ) : null}

        {step === "explorer" ? (
          <div className="mt-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep("branch")}
                className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15"
              >
                Change branch
              </button>
              <p className="text-xs text-zinc-400">
                Repo: {selectedRepo} | Branch: {selectedBranch}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-[300px_1fr]">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
                  _posts
                </p>
                <input
                  type="text"
                  value={postSearchQuery}
                  onChange={(event) => setPostSearchQuery(event.target.value)}
                  placeholder="Search markdown files"
                  className="mb-3 w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
                />
                <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900/70 p-2">
                  {isLoadingPosts ? (
                    <p className="px-3 py-2 text-sm text-zinc-300">
                      Loading markdown files...
                    </p>
                  ) : filteredPostFiles.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-zinc-300">
                      No markdown files found in _posts
                    </p>
                  ) : (
                    filteredPostFiles.map((file) => {
                      const isSelected = selectedPostPath === file.path;

                      return (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => void handleOpenFile(file)}
                          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                            isSelected
                              ? "border-white/45 bg-white/15 text-white"
                              : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/30 hover:bg-white/10"
                          }`}
                        >
                          <span className="truncate pr-3">{file.name}</span>
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="min-h-[300px] rounded-xl border border-white/15 bg-zinc-900/60">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <p className="text-sm text-zinc-200">
                    {selectedPostName || "Markdown editor"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleSaveMarkdown()}
                    disabled={
                      !selectedPostPath ||
                      isLoadingMarkdown ||
                      isSavingMarkdown ||
                      editorContent === markdownContent
                    }
                    className="rounded-lg border border-white/15 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingMarkdown ? "Saving..." : "Save"}
                  </button>
                </div>
                <div className="max-h-[420px] overflow-auto px-4 py-3">
                  {isLoadingMarkdown ? (
                    <p className="text-sm text-zinc-300">Loading file content...</p>
                  ) : selectedPostPath ? (
                    <textarea
                      value={editorContent}
                      onChange={(event) => setEditorContent(event.target.value)}
                      className="editor-scrollbar min-h-[340px] w-full resize-y rounded-lg border border-white/15 bg-zinc-950 px-3 py-2.5 font-mono text-sm leading-6 text-zinc-100 outline-none ring-white/40 focus:ring-2"
                    />
                  ) : (
                    <p className="text-sm text-zinc-300">
                      Select a markdown file to view its content.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {message ? <p className="mt-4 text-sm text-zinc-200">{message}</p> : null}
      </section>
    </main>
  );
}
