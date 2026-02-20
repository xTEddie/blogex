"use client";

import matter from "gray-matter";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FileSyncStatusValue } from "@/components/file-sync-status";
import {
  CONNECT_SESSION_KEY,
  CONNECT_SESSION_TTL_MS,
  REPOSITORY_CACHE_KEY,
  REPOSITORY_CACHE_TTL_MS,
} from "@/lib/cache-config";
import { createUpdateMarkdownCommitMessage } from "@/lib/commit-messages";
import { normalizeMarkdownFileName } from "@/lib/markdown-post";
import {
  createMarkdownFile,
  fetchMarkdownSyncDiff,
  fetchMarkdownContent,
  fetchRepositoriesPage,
  fetchRepositoryBranches,
  fetchRepositoryConfig,
  fetchRepositoryPosts,
  fetchTargetFileSyncStatus,
  renameMarkdownFile,
  saveMarkdownContent,
  type Branch,
  type PostFile,
  type Repository,
  type SyncCompareStatus,
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

export function useWorkspaceFlow() {
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

  const [step, setStep] = useState<"repository" | "branch" | "explorer">("repository");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(true);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
  const [isSavingMarkdown, setIsSavingMarkdown] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isCreatingMarkdown, setIsCreatingMarkdown] = useState(false);
  const [isRenamingMarkdown, setIsRenamingMarkdown] = useState(false);
  const [isRenameEditorOpen, setIsRenameEditorOpen] = useState(false);
  const [isComparingMarkdown, setIsComparingMarkdown] = useState(false);
  const [isComparePanelOpen, setIsComparePanelOpen] = useState(false);
  const [compareStatus, setCompareStatus] = useState<SyncCompareStatus | "idle" | "error">(
    "idle",
  );
  const [compareDiff, setCompareDiff] = useState("");
  const [compareMessage, setCompareMessage] = useState<string | null>(null);

  const [repoSearchQuery, setRepoSearchQuery] = useState("");
  const [branchSearchQuery, setBranchSearchQuery] = useState("");
  const [postSearchQuery, setPostSearchQuery] = useState("");
  const [newMarkdownTitle, setNewMarkdownTitle] = useState("");
  const [renameFileName, setRenameFileName] = useState("");
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [resumeState, setResumeState] = useState<PersistedConnectState | null>(null);
  const [targetConfig, setTargetConfig] = useState<TargetConfig | null>(null);
  const [targetStatus, setTargetStatus] = useState<TargetStatus>("unavailable");
  const syncStatusRequestId = useRef(0);

  const filteredRepositories = useMemo(() => {
    const query = repoSearchQuery.trim().toLowerCase();
    if (!query) {
      return repositories;
    }
    return repositories.filter((repo) => repo.fullName.toLowerCase().includes(query));
  }, [repositories, repoSearchQuery]);

  const filteredBranches = useMemo(() => {
    const query = branchSearchQuery.trim().toLowerCase();
    if (!query) {
      return branches;
    }
    return branches.filter((branch) => branch.name.toLowerCase().includes(query));
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

  const isRenameSaveDisabled =
    !selectedPostPath ||
    isRenamingMarkdown ||
    !renameFileName.trim() ||
    normalizeMarkdownFileName(renameFileName) === normalizeMarkdownFileName(selectedPostName);

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

      const cachedRepositories = options?.forceRefresh === true ? null : readRepositoryCache();

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
      setSelectedRepo(allRepositories.length > 0 ? allRepositories[0].fullName : "");
      setStep("repository");
      setBranches([]);
      setPostFiles([]);
      setSelectedBranch("");
      setSelectedPostPath("");
      setSelectedPostName("");
      setRenameFileName("");
      setMarkdownContent("");
      setEditorContent("");
      setEditorView("edit");
      setIsRenameEditorOpen(false);
      setIsComparePanelOpen(false);
      setCompareStatus("idle");
      setCompareDiff("");
      setCompareMessage(null);

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

      const loadedFiles = await loadPostFiles(restoredState.selectedRepo, restoredBranch);
      if (!loadedFiles) {
        return;
      }

      setStep("explorer");

      if (loadedFiles.length === 0) {
        return;
      }

      const availablePaths = new Set(loadedFiles.map((file) => file.path));
      const restoredPath =
        restoredState.selectedPostPath && availablePaths.has(restoredState.selectedPostPath)
          ? restoredState.selectedPostPath
          : loadedFiles[0].path;

      await loadMarkdownFile(restoredState.selectedRepo, restoredBranch, restoredPath);
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
      setRenameFileName(fetchedFiles.length > 0 ? fetchedFiles[0].name : "");
      setIsRenameEditorOpen(false);
      setIsComparePanelOpen(false);
      setCompareStatus("idle");
      setCompareDiff("");
      setCompareMessage(null);
      return fetchedFiles;
    } catch {
      setPostFiles([]);
      setMessage("Request failed while loading markdown files.");
      return null;
    } finally {
      setIsLoadingPosts(false);
    }
  }

  async function loadMarkdownFile(repoFullName: string, branchName: string, filePath: string) {
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
      setRenameFileName(data.name ?? filePath.split("/").pop() ?? filePath);
      setEditorView("edit");
      setIsRenameEditorOpen(false);
      setIsComparePanelOpen(false);
      setCompareStatus("idle");
      setCompareDiff("");
      setCompareMessage(null);
    } catch {
      setMessage("Request failed while loading markdown content.");
      setMarkdownContent("");
      setEditorContent("");
      setRenameFileName("");
      setIsRenameEditorOpen(false);
      setIsComparePanelOpen(false);
      setCompareStatus("idle");
      setCompareDiff("");
      setCompareMessage(null);
    } finally {
      setIsLoadingMarkdown(false);
    }
  }

  async function loadTargetConfig(repoFullName: string, branchName: string) {
    try {
      const result = await fetchRepositoryConfig(repoFullName, branchName);

      if (!result.ok) {
        setTargetConfig(null);
        setTargetStatus("unavailable");
        return null;
      }

      const data = result.data;
      const config = data.config;

      if (!data.exists || !config) {
        setTargetConfig(null);
        setTargetStatus("unavailable");
        return null;
      }

      const nextConfig: TargetConfig = {
        targetRepo: config.targetRepo?.trim() ?? "",
        targetBranch: config.targetBranch?.trim() ?? "",
        targetDirectory: config.targetDirectory?.trim() || "_posts",
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

  async function checkTargetStatus(filePath: string, configOverride?: TargetConfig | null) {
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

    window.localStorage.setItem(CONNECT_SESSION_KEY, JSON.stringify(stateToPersist));
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

  async function handleRenameMarkdown() {
    if (!selectedRepo || !selectedBranch || !selectedPostPath) {
      setMessage("Select a markdown file before renaming.");
      return;
    }

    const nextName = renameFileName.trim();
    if (!nextName) {
      setMessage("Enter a filename first.");
      return;
    }

    const normalizedCurrent = normalizeMarkdownFileName(selectedPostName);
    const normalizedNext = normalizeMarkdownFileName(nextName);

    if (normalizedCurrent && normalizedNext && normalizedCurrent === normalizedNext) {
      setIsRenameEditorOpen(false);
      return;
    }

    setIsRenamingMarkdown(true);
    setMessage(null);

    try {
      const result = await renameMarkdownFile({
        repo: selectedRepo,
        branch: selectedBranch,
        path: selectedPostPath,
        nextName,
      });

      if (!result.ok) {
        setMessage(result.error);
        return;
      }

      const data = result.data;
      const refreshedFiles = await loadPostFiles(selectedRepo, selectedBranch);
      if (refreshedFiles && data.path) {
        const renamed = refreshedFiles.find((file) => file.path === data.path);
        if (renamed) {
          await handleOpenFile(renamed);
        }
      }

      setMessage(data.message ?? "Markdown file renamed.");
      setIsRenameEditorOpen(false);
    } catch {
      setMessage("Request failed while renaming markdown file.");
    } finally {
      setIsRenamingMarkdown(false);
    }
  }

  async function handleCompareMarkdown() {
    if (!selectedRepo || !selectedBranch || !selectedPostPath) {
      setMessage("Select a markdown file before comparing.");
      return;
    }

    if (!targetConfig) {
      setIsComparePanelOpen(true);
      setCompareStatus("error");
      setCompareDiff("");
      setCompareMessage("Target repository is not configured. Update workspace settings first.");
      return;
    }

    setIsComparingMarkdown(true);
    setCompareMessage(null);

    try {
      const result = await fetchMarkdownSyncDiff({
        sourceRepo: selectedRepo,
        sourceBranch: selectedBranch,
        sourcePath: selectedPostPath,
        targetRepo: targetConfig.targetRepo,
        targetBranch: targetConfig.targetBranch,
        targetDirectory: targetConfig.targetDirectory,
      });

      setIsComparePanelOpen(true);

      if (!result.ok) {
        setCompareStatus("error");
        setCompareDiff("");
        setCompareMessage(result.error);
        return;
      }

      const data = result.data;
      const status = data.status ?? "error";

      if (status === "same") {
        setCompareMessage("Source and target files are identical.");
      } else if (status === "missing_target") {
        setCompareMessage("Target file does not exist yet.");
      } else if (status === "missing_source") {
        setCompareMessage("Source file is missing.");
      } else {
        setCompareMessage(null);
      }

      setCompareStatus(status);
      setCompareDiff(data.diff ?? "");
    } catch {
      setIsComparePanelOpen(true);
      setCompareStatus("error");
      setCompareDiff("");
      setCompareMessage("Request failed while comparing markdown files.");
    } finally {
      setIsComparingMarkdown(false);
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

  return {
    state: {
      repositories,
      selectedRepo,
      selectedBranch,
      selectedPostPath,
      selectedPostName,
      markdownContent,
      editorContent,
      editorView,
      step,
      message,
      isLoadingRepositories,
      isLoadingBranches,
      isLoadingPosts,
      isLoadingMarkdown,
      isSavingMarkdown,
      isResuming,
      isCreatingMarkdown,
      isRenamingMarkdown,
      isRenameEditorOpen,
      isComparingMarkdown,
      isComparePanelOpen,
      compareStatus,
      compareDiff,
      compareMessage,
      repoSearchQuery,
      branchSearchQuery,
      postSearchQuery,
      newMarkdownTitle,
      renameFileName,
      totalPages,
      resumeState,
      targetStatus,
    },
    derived: {
      filteredRepositories,
      filteredBranches,
      filteredPostFiles,
      frontmatterEntries,
      parsedEditorBody: parsedEditorMarkdown.body,
      isRenameSaveDisabled,
    },
    actions: {
      setRepoSearchQuery,
      setBranchSearchQuery,
      setPostSearchQuery,
      setSelectedRepo,
      setSelectedBranch,
      setNewMarkdownTitle,
      setRenameFileName,
      setEditorView,
      setEditorContent,
      setStep,
      openRenameEditor: () => setIsRenameEditorOpen(true),
      closeRenameEditor: () => {
        setIsRenameEditorOpen(false);
        setRenameFileName(selectedPostName);
      },
      closeComparePanel: () => setIsComparePanelOpen(false),
      startFresh: handleStartFresh,
      resumeSession: handleResumeSession,
      refreshRepositories: handleRefreshRepositories,
      nextToBranches: handleNextToBranches,
      connectToExplorer: handleConnectToExplorer,
      openFile: handleOpenFile,
      saveMarkdown: handleSaveMarkdown,
      createMarkdown: handleCreateMarkdownFile,
      renameMarkdown: handleRenameMarkdown,
      compareMarkdown: handleCompareMarkdown,
    },
  };
}
