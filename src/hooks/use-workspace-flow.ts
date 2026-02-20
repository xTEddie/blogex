"use client";

import matter from "gray-matter";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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

/**
 * UI-only state for the workspace flow.
 *
 * This reducer intentionally owns transient UI concerns (panels, loading flags,
 * compare status, user-facing message) while domain selections/content are kept
 * in dedicated `useState` fields.
 */
type WorkspaceUIState = {
  step: "repository" | "branch" | "explorer";
  message: string | null;
  editorView: "edit" | "preview";
  isLoadingRepositories: boolean;
  isLoadingBranches: boolean;
  isLoadingPosts: boolean;
  isLoadingMarkdown: boolean;
  isSavingMarkdown: boolean;
  isResuming: boolean;
  isCreatingMarkdown: boolean;
  isRenamingMarkdown: boolean;
  isRenameEditorOpen: boolean;
  isComparingMarkdown: boolean;
  isComparePanelOpen: boolean;
  compareStatus: SyncCompareStatus | "idle" | "error";
  compareDiff: string;
  compareMessage: string | null;
};

type WorkspaceUILoadingKey =
  | "isLoadingRepositories"
  | "isLoadingBranches"
  | "isLoadingPosts"
  | "isLoadingMarkdown"
  | "isSavingMarkdown"
  | "isResuming"
  | "isCreatingMarkdown"
  | "isRenamingMarkdown"
  | "isComparingMarkdown";

type WorkspaceUIAction =
  | { type: "set_step"; step: WorkspaceUIState["step"] }
  | { type: "set_message"; message: string | null }
  | { type: "set_editor_view"; editorView: WorkspaceUIState["editorView"] }
  | { type: "set_loading"; key: WorkspaceUILoadingKey; value: boolean }
  | { type: "open_rename_editor" }
  | { type: "close_rename_editor" }
  | { type: "open_compare_panel" }
  | { type: "close_compare_panel" }
  | {
      type: "set_compare";
      compareStatus?: WorkspaceUIState["compareStatus"];
      compareDiff?: string;
      compareMessage?: string | null;
    }
  | { type: "reset_compare" }
  | { type: "reset_editor_ui" };

const INITIAL_WORKSPACE_UI_STATE: WorkspaceUIState = {
  step: "repository",
  message: null,
  editorView: "edit",
  isLoadingRepositories: true,
  isLoadingBranches: false,
  isLoadingPosts: false,
  isLoadingMarkdown: false,
  isSavingMarkdown: false,
  isResuming: false,
  isCreatingMarkdown: false,
  isRenamingMarkdown: false,
  isRenameEditorOpen: false,
  isComparingMarkdown: false,
  isComparePanelOpen: false,
  compareStatus: "idle",
  compareDiff: "",
  compareMessage: null,
};

/**
 * Reducer for predictable UI transitions in the workspace flow.
 *
 * Note: `reset_editor_ui` is used after repository/branch/file switches to
 * avoid leaking editor/compare UI state across different files.
 */
function workspaceUIReducer(
  state: WorkspaceUIState,
  action: WorkspaceUIAction,
): WorkspaceUIState {
  switch (action.type) {
    case "set_step":
      return { ...state, step: action.step };
    case "set_message":
      return { ...state, message: action.message };
    case "set_editor_view":
      return { ...state, editorView: action.editorView };
    case "set_loading":
      return { ...state, [action.key]: action.value };
    case "open_rename_editor":
      return { ...state, isRenameEditorOpen: true };
    case "close_rename_editor":
      return { ...state, isRenameEditorOpen: false };
    case "open_compare_panel":
      return { ...state, isComparePanelOpen: true };
    case "close_compare_panel":
      return { ...state, isComparePanelOpen: false };
    case "set_compare":
      return {
        ...state,
        compareStatus: action.compareStatus ?? state.compareStatus,
        compareDiff: action.compareDiff ?? state.compareDiff,
        compareMessage:
          action.compareMessage !== undefined ? action.compareMessage : state.compareMessage,
      };
    case "reset_compare":
      return {
        ...state,
        isComparePanelOpen: false,
        compareStatus: "idle",
        compareDiff: "",
        compareMessage: null,
      };
    case "reset_editor_ui":
      return {
        ...state,
        editorView: "edit",
        isRenameEditorOpen: false,
        isComparePanelOpen: false,
        compareStatus: "idle",
        compareDiff: "",
        compareMessage: null,
      };
    default:
      return state;
  }
}

/**
 * Orchestrates the end-to-end workspace wizard:
 * repository -> branch -> markdown explorer/editor.
 *
 * Public contract:
 * - `state`: source-of-truth values consumed by page/step components.
 * - `derived`: memoized computed values (filters, frontmatter parse, guards).
 * - `actions`: user-triggered workflows and setters.
 */
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
  const [uiState, dispatchUI] = useReducer(workspaceUIReducer, INITIAL_WORKSPACE_UI_STATE);

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

  const {
    step,
    message,
    editorView,
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
  } = uiState;

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

  /**
   * Exhaustively loads all pages from the repositories API endpoint.
   * Used when local cache is absent/expired or refresh is explicitly requested.
   */
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

  /**
   * Reads repository cache from localStorage and invalidates malformed/expired entries.
   */
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

  /**
   * Persists the flattened repository list used by the repository step search UI.
   */
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

  /**
   * Loads repositories and optionally restores a previously persisted wizard state.
   * This is the bootstrap entrypoint for the workspace page.
   */
  async function loadAllRepositories(
    restoredState?: PersistedConnectState,
    options?: { forceRefresh?: boolean },
  ) {
    dispatchUI({ type: "set_loading", key: "isLoadingRepositories", value: true });
    dispatchUI({ type: "set_message", message: null });

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
          dispatchUI({ type: "set_message", message: result.error });
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
      dispatchUI({ type: "set_step", step: "repository" });
      setBranches([]);
      setPostFiles([]);
      setSelectedBranch("");
      setSelectedPostPath("");
      setSelectedPostName("");
      setRenameFileName("");
      setMarkdownContent("");
      setEditorContent("");
      dispatchUI({ type: "reset_editor_ui" });

      if (!restoredState?.selectedRepo) {
        return;
      }

      const availableRepos = new Set(allRepositories.map((repo) => repo.fullName));
      if (!availableRepos.has(restoredState.selectedRepo)) {
        dispatchUI({
          type: "set_message",
          message: "Saved session repo is no longer available.",
        });
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
        dispatchUI({ type: "set_step", step: "branch" });
        return;
      }

      const loadedFiles = await loadPostFiles(restoredState.selectedRepo, restoredBranch);
      if (!loadedFiles) {
        return;
      }

      dispatchUI({ type: "set_step", step: "explorer" });

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
      dispatchUI({
        type: "set_message",
        message: "Request failed while loading repositories.",
      });
    } finally {
      dispatchUI({ type: "set_loading", key: "isLoadingRepositories", value: false });
    }
  }

  /** Loads branch options for the selected repository. */
  async function loadBranches(repoFullName: string) {
    dispatchUI({ type: "set_loading", key: "isLoadingBranches", value: true });
    dispatchUI({ type: "set_message", message: null });

    try {
      const result = await fetchRepositoryBranches(repoFullName);

      if (!result.ok) {
        dispatchUI({ type: "set_message", message: result.error });
        setBranches([]);
        return null;
      }

      const fetchedBranches = result.branches;
      setBranches(fetchedBranches);
      setSelectedBranch(fetchedBranches.length > 0 ? fetchedBranches[0].name : "");
      return fetchedBranches;
    } catch {
      setBranches([]);
      dispatchUI({ type: "set_message", message: "Request failed while loading branches." });
      return null;
    } finally {
      dispatchUI({ type: "set_loading", key: "isLoadingBranches", value: false });
    }
  }

  /** Loads markdown files under `_posts` for a repo/branch pair. */
  async function loadPostFiles(repoFullName: string, branchName: string) {
    dispatchUI({ type: "set_loading", key: "isLoadingPosts", value: true });
    dispatchUI({ type: "set_message", message: null });

    try {
      const result = await fetchRepositoryPosts(repoFullName, branchName);

      if (!result.ok) {
        dispatchUI({ type: "set_message", message: result.error });
        setPostFiles([]);
        return null;
      }

      const fetchedFiles = result.files;
      setPostFiles(fetchedFiles);
      setSelectedPostPath(fetchedFiles.length > 0 ? fetchedFiles[0].path : "");
      setSelectedPostName(fetchedFiles.length > 0 ? fetchedFiles[0].name : "");
      setRenameFileName(fetchedFiles.length > 0 ? fetchedFiles[0].name : "");
      dispatchUI({ type: "reset_editor_ui" });
      return fetchedFiles;
    } catch {
      setPostFiles([]);
      dispatchUI({
        type: "set_message",
        message: "Request failed while loading markdown files.",
      });
      return null;
    } finally {
      dispatchUI({ type: "set_loading", key: "isLoadingPosts", value: false });
    }
  }

  /** Loads one markdown file and resets editor-specific UI state. */
  async function loadMarkdownFile(repoFullName: string, branchName: string, filePath: string) {
    dispatchUI({ type: "set_loading", key: "isLoadingMarkdown", value: true });
    dispatchUI({ type: "set_message", message: null });

    try {
      const result = await fetchMarkdownContent(repoFullName, branchName, filePath);

      if (!result.ok) {
        dispatchUI({ type: "set_message", message: result.error });
        setMarkdownContent("");
        return;
      }

      const data = result.data;
      setMarkdownContent(data.markdown ?? "");
      setEditorContent(data.markdown ?? "");
      setSelectedPostPath(data.path ?? filePath);
      setSelectedPostName(data.name ?? filePath.split("/").pop() ?? filePath);
      setRenameFileName(data.name ?? filePath.split("/").pop() ?? filePath);
      dispatchUI({ type: "reset_editor_ui" });
    } catch {
      dispatchUI({
        type: "set_message",
        message: "Request failed while loading markdown content.",
      });
      setMarkdownContent("");
      setEditorContent("");
      setRenameFileName("");
      dispatchUI({ type: "reset_editor_ui" });
    } finally {
      dispatchUI({ type: "set_loading", key: "isLoadingMarkdown", value: false });
    }
  }

  /** Reads target sync configuration from `blogex.config.json` for status/compare flows. */
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

  /**
   * Checks if the selected source markdown exists in the configured target repo.
   * A request id guard prevents stale async responses from overwriting newer state.
   */
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

  /**
   * Initial bootstrap:
   * 1) load repositories (cache-first),
   * 2) detect resumable workspace session from localStorage.
   */
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

  /** Persists current wizard context to support "resume workspace session". */
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
      dispatchUI({ type: "set_message", message: "Select a repository first." });
      return;
    }

    const fetchedBranches = await loadBranches(selectedRepo);
    if (fetchedBranches) {
      dispatchUI({ type: "set_step", step: "branch" });
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

    dispatchUI({ type: "set_loading", key: "isResuming", value: true });
    dispatchUI({ type: "set_message", message: null });
    await loadAllRepositories(resumeState);
    setResumeState(null);
    dispatchUI({ type: "set_loading", key: "isResuming", value: false });
  }

  async function handleRefreshRepositories() {
    await loadAllRepositories(undefined, { forceRefresh: true });
  }

  async function handleConnectToExplorer() {
    if (!selectedRepo || !selectedBranch) {
      dispatchUI({
        type: "set_message",
        message: "Select a repository and branch first.",
      });
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

    dispatchUI({ type: "set_step", step: "explorer" });

    const config = await loadTargetConfig(selectedRepo, selectedBranch);
    if (loadedFiles.length > 0) {
      await checkTargetStatus(loadedFiles[0].path, config);
    } else {
      setTargetStatus("unavailable");
    }
  }

  async function handleOpenFile(file: PostFile) {
    if (!selectedRepo || !selectedBranch) {
      dispatchUI({
        type: "set_message",
        message: "Repository or branch is not selected.",
      });
      return;
    }

    await loadMarkdownFile(selectedRepo, selectedBranch, file.path);
    await checkTargetStatus(file.path);
  }

  async function handleSaveMarkdown() {
    if (!selectedRepo || !selectedBranch || !selectedPostPath) {
      dispatchUI({
        type: "set_message",
        message: "Select a markdown file before saving.",
      });
      return;
    }

    dispatchUI({ type: "set_loading", key: "isSavingMarkdown", value: true });
    dispatchUI({ type: "set_message", message: null });

    try {
      const result = await saveMarkdownContent({
        repo: selectedRepo,
        branch: selectedBranch,
        path: selectedPostPath,
        markdown: editorContent,
        message: createUpdateMarkdownCommitMessage(selectedPostName),
      });

      if (!result.ok) {
        dispatchUI({ type: "set_message", message: result.error });
        return;
      }

      setMarkdownContent(editorContent);
      dispatchUI({
        type: "set_message",
        message: result.data.message ?? "Saved successfully.",
      });
    } catch {
      dispatchUI({
        type: "set_message",
        message: "Request failed while saving markdown file.",
      });
    } finally {
      dispatchUI({ type: "set_loading", key: "isSavingMarkdown", value: false });
    }
  }

  async function handleCreateMarkdownFile() {
    if (!selectedRepo || !selectedBranch) {
      dispatchUI({
        type: "set_message",
        message: "Select a repository and branch first.",
      });
      return;
    }

    const inputTitle = newMarkdownTitle.trim();
    if (!inputTitle) {
      dispatchUI({ type: "set_message", message: "Enter a title first." });
      return;
    }

    dispatchUI({ type: "set_loading", key: "isCreatingMarkdown", value: true });
    dispatchUI({ type: "set_message", message: null });

    try {
      const result = await createMarkdownFile({
        repo: selectedRepo,
        branch: selectedBranch,
        title: inputTitle,
      });

      if (!result.ok) {
        dispatchUI({ type: "set_message", message: result.error });
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
      dispatchUI({
        type: "set_message",
        message: data.message ?? "Markdown file created.",
      });
    } catch {
      dispatchUI({
        type: "set_message",
        message: "Request failed while creating markdown file.",
      });
    } finally {
      dispatchUI({ type: "set_loading", key: "isCreatingMarkdown", value: false });
    }
  }

  async function handleRenameMarkdown() {
    if (!selectedRepo || !selectedBranch || !selectedPostPath) {
      dispatchUI({
        type: "set_message",
        message: "Select a markdown file before renaming.",
      });
      return;
    }

    const nextName = renameFileName.trim();
    if (!nextName) {
      dispatchUI({ type: "set_message", message: "Enter a filename first." });
      return;
    }

    const normalizedCurrent = normalizeMarkdownFileName(selectedPostName);
    const normalizedNext = normalizeMarkdownFileName(nextName);

    if (normalizedCurrent && normalizedNext && normalizedCurrent === normalizedNext) {
      dispatchUI({ type: "close_rename_editor" });
      return;
    }

    dispatchUI({ type: "set_loading", key: "isRenamingMarkdown", value: true });
    dispatchUI({ type: "set_message", message: null });

    try {
      const result = await renameMarkdownFile({
        repo: selectedRepo,
        branch: selectedBranch,
        path: selectedPostPath,
        nextName,
      });

      if (!result.ok) {
        dispatchUI({ type: "set_message", message: result.error });
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

      dispatchUI({
        type: "set_message",
        message: data.message ?? "Markdown file renamed.",
      });
      dispatchUI({ type: "close_rename_editor" });
    } catch {
      dispatchUI({
        type: "set_message",
        message: "Request failed while renaming markdown file.",
      });
    } finally {
      dispatchUI({ type: "set_loading", key: "isRenamingMarkdown", value: false });
    }
  }

  /**
   * Computes source vs target diff for the currently selected markdown file.
   * The compare panel is opened for both success and error outcomes so the user
   * always gets explicit feedback.
   */
  async function handleCompareMarkdown() {
    if (!selectedRepo || !selectedBranch || !selectedPostPath) {
      dispatchUI({
        type: "set_message",
        message: "Select a markdown file before comparing.",
      });
      return;
    }

    if (!targetConfig) {
      dispatchUI({ type: "open_compare_panel" });
      dispatchUI({
        type: "set_compare",
        compareStatus: "error",
        compareDiff: "",
        compareMessage:
          "Target repository is not configured. Update workspace settings first.",
      });
      return;
    }

    dispatchUI({ type: "set_loading", key: "isComparingMarkdown", value: true });
    dispatchUI({ type: "set_compare", compareMessage: null });

    try {
      const result = await fetchMarkdownSyncDiff({
        sourceRepo: selectedRepo,
        sourceBranch: selectedBranch,
        sourcePath: selectedPostPath,
        targetRepo: targetConfig.targetRepo,
        targetBranch: targetConfig.targetBranch,
        targetDirectory: targetConfig.targetDirectory,
      });

      dispatchUI({ type: "open_compare_panel" });

      if (!result.ok) {
        dispatchUI({
          type: "set_compare",
          compareStatus: "error",
          compareDiff: "",
          compareMessage: result.error,
        });
        return;
      }

      const data = result.data;
      const status = data.status ?? "error";

      if (status === "same") {
        dispatchUI({
          type: "set_compare",
          compareMessage: "Source and target files are identical.",
        });
      } else if (status === "missing_target") {
        dispatchUI({
          type: "set_compare",
          compareMessage: "Target file does not exist yet.",
        });
      } else if (status === "missing_source") {
        dispatchUI({
          type: "set_compare",
          compareMessage: "Source file is missing.",
        });
      } else {
        dispatchUI({ type: "set_compare", compareMessage: null });
      }

      dispatchUI({
        type: "set_compare",
        compareStatus: status,
        compareDiff: data.diff ?? "",
      });
    } catch {
      dispatchUI({ type: "open_compare_panel" });
      dispatchUI({
        type: "set_compare",
        compareStatus: "error",
        compareDiff: "",
        compareMessage: "Request failed while comparing markdown files.",
      });
    } finally {
      dispatchUI({ type: "set_loading", key: "isComparingMarkdown", value: false });
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

  // Stable public API consumed by `connect-repositories-page`.
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
      setEditorView: (nextView: "edit" | "preview") =>
        dispatchUI({ type: "set_editor_view", editorView: nextView }),
      setEditorContent,
      setStep: (nextStep: "repository" | "branch" | "explorer") =>
        dispatchUI({ type: "set_step", step: nextStep }),
      openRenameEditor: () => dispatchUI({ type: "open_rename_editor" }),
      closeRenameEditor: () => {
        dispatchUI({ type: "close_rename_editor" });
        setRenameFileName(selectedPostName);
      },
      closeComparePanel: () => dispatchUI({ type: "close_compare_panel" }),
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
