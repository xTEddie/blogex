"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import matter from "gray-matter";
import remarkGfm from "remark-gfm";
import FileSyncStatus, {
  type FileSyncStatusValue,
} from "@/components/file-sync-status";
import { createUpdateMarkdownCommitMessage } from "@/lib/commit-messages";
import { CONNECT_SESSION_KEY, CONNECT_SESSION_TTL_MS } from "@/lib/connect-session";
import {
  createMarkdownFile,
  fetchMarkdownContent,
  fetchRepositoriesPage,
  fetchRepositoryBranches,
  fetchRepositoryConfig,
  fetchRepositoryPosts,
  fetchTargetFileSyncStatus,
  saveMarkdownContent,
  type Branch,
  type PostFile,
  type Repository,
} from "@/lib/workspace-client";

type TargetConfig = {
  targetRepo: string;
  targetBranch: string;
  targetDirectory: string;
};

type TargetStatus = FileSyncStatusValue;

type PersistedConnectState = {
  selectedRepo?: string;
  selectedBranch?: string;
  selectedPostPath?: string;
  step?: "repository" | "branch" | "explorer";
  updatedAt: number;
};

type RepositoryCacheState = {
  repositories: Repository[];
  totalPages: number | null;
  updatedAt: number;
};

const REPOSITORY_CACHE_KEY = "blogex:repositories-cache";
const REPOSITORY_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

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
  const [editorView, setEditorView] = useState<"edit" | "preview">("edit");

  const [step, setStep] = useState<"repository" | "branch" | "explorer">(
    "repository",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(true);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
  const [isSavingMarkdown, setIsSavingMarkdown] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCreatingMarkdown, setIsCreatingMarkdown] = useState(false);

  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [branchSearchQuery, setBranchSearchQuery] = useState("");
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [newMarkdownTitle, setNewMarkdownTitle] = useState("");
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [resumeState, setResumeState] = useState<PersistedConnectState | null>(
    null,
  );
  const [targetConfig, setTargetConfig] = useState<TargetConfig | null>(null);
  const [targetStatus, setTargetStatus] = useState<TargetStatus>("unavailable");
  const syncStatusRequestId = useRef(0);

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
  const parsedEditorMarkdown = useMemo(() => {
    try {
      const parsed = matter(editorContent);
      return {
        body: parsed.content,
        frontmatter: parsed.data as Record<string, unknown>,
      };
    } catch {
      return {
        body: editorContent,
        frontmatter: {} as Record<string, unknown>,
      };
    }
  }, [editorContent]);
  const frontmatterEntries = useMemo(
    () => Object.entries(parsedEditorMarkdown.frontmatter),
    [parsedEditorMarkdown.frontmatter],
  );

  async function loadRepositoriesFromApi() {
    const allRepositories: Repository[] = [];
    let currentPage = 1;
    let hasNext = true;
    let resolvedTotalPages: number | null = null;

    while (hasNext) {
      const result = await fetchRepositoriesPage(currentPage, 100);

      if (!result.ok) {
        return {
          ok: false as const,
          error: result.error,
        };
      }

      allRepositories.push(...result.repositories);
      resolvedTotalPages = result.totalPages ?? resolvedTotalPages;

      const pageFromResponse = result.page;
      const perPage = result.perPage;
      hasNext =
        resolvedTotalPages !== null
          ? pageFromResponse < resolvedTotalPages
          : result.repositories.length === perPage;
      currentPage += 1;
    }

    return {
      ok: true as const,
      repositories: allRepositories,
      totalPages: resolvedTotalPages,
    };
  }

  function readRepositoryCache(): RepositoryCacheState | null {
    if (typeof window === "undefined") {
      return null;
    }

    try {
      const raw = window.localStorage.getItem(REPOSITORY_CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as RepositoryCacheState;
      const isExpired =
        !parsed.updatedAt || Date.now() - parsed.updatedAt > REPOSITORY_CACHE_TTL_MS;

      if (isExpired || !Array.isArray(parsed.repositories)) {
        window.localStorage.removeItem(REPOSITORY_CACHE_KEY);
        return null;
      }

      return parsed;
    } catch {
      window.localStorage.removeItem(REPOSITORY_CACHE_KEY);
      return null;
    }
  }

  function writeRepositoryCache(repositoriesToCache: Repository[], pages: number | null) {
    if (typeof window === "undefined") {
      return;
    }

    const payload: RepositoryCacheState = {
      repositories: repositoriesToCache,
      totalPages: pages,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(REPOSITORY_CACHE_KEY, JSON.stringify(payload));
  }

  async function loadAllRepositories(
    restoredState?: PersistedConnectState,
    options?: { forceRefresh?: boolean },
  ) {
    setIsLoadingRepositories(true);
    setMessage(null);

    try {
      let allRepositories: Repository[] = [];
      let resolvedTotalPages: number | null = null;

      const cachedRepositories =
        options?.forceRefresh === true ? null : readRepositoryCache();

      if (cachedRepositories) {
        allRepositories = cachedRepositories.repositories;
        resolvedTotalPages = cachedRepositories.totalPages;
      } else {
        const result = await loadRepositoriesFromApi();
        if (!result.ok) {
          setMessage(result.error);
          setRepositories([]);
          return;
        }

        allRepositories = result.repositories;
        resolvedTotalPages = result.totalPages;
        writeRepositoryCache(allRepositories, resolvedTotalPages);
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
      setEditorView("edit");

      if (!restoredState?.selectedRepo) {
        return;
      }

      const availableRepos = new Set(allRepositories.map((repo) => repo.fullName));
      if (!availableRepos.has(restoredState.selectedRepo)) {
        setMessage("Saved session repo is no longer available.");
        return;
      }

      setSelectedRepo(restoredState.selectedRepo);

      if (!restoredState.step || restoredState.step === "repository") {
        return;
      }

      const fetchedBranches = await loadBranches(restoredState.selectedRepo);
      if (!fetchedBranches || fetchedBranches.length === 0) {
        return;
      }

      const availableBranches = new Set(fetchedBranches.map((branch) => branch.name));
      const restoredBranch =
        restoredState.selectedBranch && availableBranches.has(restoredState.selectedBranch)
          ? restoredState.selectedBranch
          : fetchedBranches[0].name;

      setSelectedBranch(restoredBranch);

      if (restoredState.step === "branch") {
        setStep("branch");
        return;
      }

      const loadedFiles = await loadPostFiles(
        restoredState.selectedRepo,
        restoredBranch,
      );
      if (!loadedFiles) {
        return;
      }

      setStep("explorer");

      if (loadedFiles.length === 0) {
        return;
      }

      const availablePaths = new Set(loadedFiles.map((file) => file.path));
      const restoredPath =
        restoredState.selectedPostPath &&
        availablePaths.has(restoredState.selectedPostPath)
          ? restoredState.selectedPostPath
          : loadedFiles[0].path;

      await loadMarkdownFile(
        restoredState.selectedRepo,
        restoredBranch,
        restoredPath,
      );
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
      const result = await fetchRepositoryBranches(repoFullName);

      if (!result.ok) {
        setMessage(result.error);
        setBranches([]);
        return null;
      }

      const fetchedBranches = result.branches;
      setBranches(fetchedBranches);
      setSelectedBranch(fetchedBranches.length > 0 ? fetchedBranches[0].name : "");
      return fetchedBranches;
    } catch {
      setBranches([]);
      setMessage("Request failed while loading branches.");
      return null;
    } finally {
      setIsLoadingBranches(false);
    }
  }

  async function loadPostFiles(repoFullName: string, branchName: string) {
    setIsLoadingPosts(true);
    setMessage(null);

    try {
      const result = await fetchRepositoryPosts(repoFullName, branchName);

      if (!result.ok) {
        setMessage(result.error);
        setPostFiles([]);
        return null;
      }

      const fetchedFiles = result.files;
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
      const result = await fetchMarkdownContent(repoFullName, branchName, filePath);

      if (!result.ok) {
        setMessage(result.error);
        setMarkdownContent("");
        return;
      }

      const data = result.data;
      setMarkdownContent(data.markdown ?? "");
      setEditorContent(data.markdown ?? "");
      setSelectedPostPath(data.path ?? filePath);
      setSelectedPostName(data.name ?? filePath.split("/").pop() ?? filePath);
      setEditorView("edit");
    } catch {
      setMessage("Request failed while loading markdown content.");
      setMarkdownContent("");
      setEditorContent("");
    } finally {
      setIsLoadingMarkdown(false);
    }
  }

  async function loadTargetConfig(repoFullName: string, branchName: string) {
    try {
      const result = await fetchRepositoryConfig(repoFullName, branchName);

      if (!result.ok || !result.data.exists || !result.data.config) {
        setTargetConfig(null);
        setTargetStatus("unavailable");
        return null;
      }

      const data = result.data;
      const nextConfig: TargetConfig = {
        targetRepo: data.config.targetRepo?.trim() ?? "",
        targetBranch: data.config.targetBranch?.trim() ?? "",
        targetDirectory: data.config.targetDirectory?.trim() || "_posts",
      };

      if (!nextConfig.targetRepo || !nextConfig.targetBranch) {
        setTargetConfig(null);
        setTargetStatus("unavailable");
        return null;
      }

      setTargetConfig(nextConfig);
      return nextConfig;
    } catch {
      setTargetConfig(null);
      setTargetStatus("error");
      return null;
    }
  }

  async function checkTargetStatus(
    filePath: string,
    configOverride?: TargetConfig | null,
  ) {
    const config = configOverride ?? targetConfig;

    if (!config || !filePath) {
      setTargetStatus("unavailable");
      return;
    }

    const requestId = syncStatusRequestId.current + 1;
    syncStatusRequestId.current = requestId;
    setTargetStatus("checking");

    try {
      const result = await fetchTargetFileSyncStatus({
        targetRepo: config.targetRepo,
        targetBranch: config.targetBranch,
        targetDirectory: config.targetDirectory,
        sourcePath: filePath,
      });

      if (syncStatusRequestId.current !== requestId) {
        return;
      }

      if (!result.ok) {
        setTargetStatus(result.error ? "error" : "unavailable");
        return;
      }

      setTargetStatus(result.data.exists ? "exists" : "missing");
    } catch {
      if (syncStatusRequestId.current === requestId) {
        setTargetStatus("error");
      }
    }
  }

  useEffect(() => {
    void loadAllRepositories();

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

      if (isExpired || !parsed.selectedRepo) {
        window.localStorage.removeItem(CONNECT_SESSION_KEY);
        return;
      }

      setResumeState(parsed);
    } catch {
      window.localStorage.removeItem(CONNECT_SESSION_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!selectedRepo) {
      return;
    }

    const stateToPersist: PersistedConnectState = {
      selectedRepo,
      selectedBranch,
      selectedPostPath,
      step,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(
      CONNECT_SESSION_KEY,
      JSON.stringify(stateToPersist),
    );
  }, [selectedRepo, selectedBranch, selectedPostPath, step]);

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

    const fetchedBranches = await loadBranches(selectedRepo);
    if (fetchedBranches) {
      setStep("branch");
    }
  }

  function handleStartFresh() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(CONNECT_SESSION_KEY);
    }
    setResumeState(null);
  }

  async function handleResumeSession() {
    if (!resumeState) {
      return;
    }

    setIsResuming(true);
    setMessage(null);
    await loadAllRepositories(resumeState);
    setResumeState(null);
    setIsResuming(false);
  }

  async function handleRefreshRepositories() {
    await loadAllRepositories(undefined, { forceRefresh: true });
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

    const config = await loadTargetConfig(selectedRepo, selectedBranch);
    if (loadedFiles.length > 0) {
      await checkTargetStatus(loadedFiles[0].path, config);
    } else {
      setTargetStatus("unavailable");
    }
  }

  async function handleOpenFile(file: PostFile) {
    if (!selectedRepo || !selectedBranch) {
      setMessage("Repository or branch is not selected.");
      return;
    }

    await loadMarkdownFile(selectedRepo, selectedBranch, file.path);
    await checkTargetStatus(file.path);
  }

  async function handleSaveMarkdown() {
    if (!selectedRepo || !selectedBranch || !selectedPostPath) {
      setMessage("Select a markdown file before saving.");
      return;
    }

    setIsSavingMarkdown(true);
    setMessage(null);

    try {
      const result = await saveMarkdownContent({
        repo: selectedRepo,
        branch: selectedBranch,
        path: selectedPostPath,
        markdown: editorContent,
        message: createUpdateMarkdownCommitMessage(selectedPostName),
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      setMarkdownContent(editorContent);
      setMessage(result.data.message ?? "Saved successfully.");
    } catch {
      setMessage("Request failed while saving markdown file.");
    } finally {
      setIsSavingMarkdown(false);
    }
  }

  async function handleCreateMarkdownFile() {
    if (!selectedRepo || !selectedBranch) {
      setMessage("Select a repository and branch first.");
      return;
    }

    const inputTitle = newMarkdownTitle.trim();
    if (!inputTitle) {
      setMessage("Enter a title first.");
      return;
    }

    setIsCreatingMarkdown(true);
    setMessage(null);

    try {
      const result = await createMarkdownFile({
        repo: selectedRepo,
        branch: selectedBranch,
        title: inputTitle,
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      const data = result.data;

      const refreshedFiles = await loadPostFiles(selectedRepo, selectedBranch);
      if (refreshedFiles && data.path) {
        const created = refreshedFiles.find((file) => file.path === data.path);
        if (created) {
          await handleOpenFile(created);
        }
      }

      setNewMarkdownTitle("");
      setMessage(data.message ?? "Markdown file created.");
    } catch {
      setMessage("Request failed while creating markdown file.");
    } finally {
      setIsCreatingMarkdown(false);
    }
  }

  useEffect(() => {
    if (step !== "explorer" || !selectedRepo || !selectedBranch) {
      return;
    }

    void loadTargetConfig(selectedRepo, selectedBranch);
  }, [step, selectedRepo, selectedBranch]);

  useEffect(() => {
    if (step !== "explorer" || !selectedPostPath) {
      return;
    }

    void checkTargetStatus(selectedPostPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedPostPath, targetConfig]);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 sm:px-6">
      <section className="mx-auto w-full max-w-5xl rounded-2xl border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Workspace
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/workspace/settings"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 sm:text-sm"
            >
              Settings
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
          {step === "repository"
            ? "Select a repository."
            : step === "branch"
              ? "Select a branch."
              : "Browse markdown files in _posts."}
        </p>
        {resumeState ? (
          <div className="mt-4 rounded-xl border border-white/15 bg-white/10 p-4">
            <p className="text-sm text-zinc-100">
              Existing workspace session found. Do you want to resume?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void handleResumeSession()}
                disabled={isResuming}
                className="rounded-lg border border-white/15 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResuming ? "Resuming..." : "Resume"}
              </button>
              <button
                type="button"
                onClick={handleStartFresh}
                disabled={isResuming}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start fresh
              </button>
            </div>
          </div>
        ) : null}

        {step === "repository" ? (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
              Repository
            </p>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={repoSearchQuery}
                onChange={(event) => setRepoSearchQuery(event.target.value)}
                placeholder="Search repositories"
                className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
              />
              <button
                type="button"
                onClick={() => void handleRefreshRepositories()}
                disabled={isLoadingRepositories}
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
              >
                {isLoadingRepositories ? "Refreshing..." : "Refresh"}
              </button>
            </div>
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
                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    value={newMarkdownTitle}
                    onChange={(event) => setNewMarkdownTitle(event.target.value)}
                    placeholder="My New Post"
                    className="w-full rounded-xl border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-white/40 placeholder:text-zinc-500 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateMarkdownFile()}
                    disabled={isCreatingMarkdown || !newMarkdownTitle.trim()}
                    className="shrink-0 rounded-xl border border-white/15 bg-white/95 px-3 py-2.5 text-xs font-medium text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingMarkdown ? "Creating..." : "Create"}
                  </button>
                </div>
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
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-zinc-200">
                      {selectedPostName || "Markdown editor"}
                    </p>
                    {selectedPostPath ? <FileSyncStatus status={targetStatus} /> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg border border-white/15 bg-white/10 p-1">
                      <button
                        type="button"
                        onClick={() => setEditorView("edit")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          editorView === "edit"
                            ? "bg-white text-zinc-900"
                            : "text-zinc-200 hover:bg-white/15"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorView("preview")}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                          editorView === "preview"
                            ? "bg-white text-zinc-900"
                            : "text-zinc-200 hover:bg-white/15"
                        }`}
                      >
                        Preview
                      </button>
                    </div>
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
                </div>
                <div className="max-h-[420px] overflow-auto px-4 py-3">
                  {isLoadingMarkdown ? (
                    <p className="text-sm text-zinc-300">Loading file content...</p>
                  ) : selectedPostPath && editorView === "edit" ? (
                    <textarea
                      value={editorContent}
                      onChange={(event) => setEditorContent(event.target.value)}
                      className="min-h-[340px] w-full resize-y rounded-lg border border-white/15 bg-zinc-950 px-3 py-2.5 font-mono text-sm leading-6 text-zinc-100 outline-none ring-white/40 focus:ring-2"
                    />
                  ) : selectedPostPath && editorView === "preview" ? (
                    <div className="markdown-preview text-sm leading-6 text-zinc-100">
                      {frontmatterEntries.length > 0 ? (
                        <div className="mb-4 rounded-lg border border-white/15 bg-zinc-950/80 p-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-300">
                            Front Matter
                          </p>
                          <div className="space-y-1 text-xs text-zinc-200">
                            {frontmatterEntries.map(([key, value]) => (
                              <p key={key}>
                                <span className="text-zinc-400">{key}:</span>{" "}
                                <span className="font-mono">
                                  {typeof value === "string"
                                    ? value
                                    : JSON.stringify(value)}
                                </span>
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {parsedEditorMarkdown.body}
                      </ReactMarkdown>
                    </div>
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
