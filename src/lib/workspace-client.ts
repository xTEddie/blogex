export type Repository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
};

export type Branch = {
  name: string;
};

export type PostFile = {
  name: string;
  path: string;
  size: number;
};

export type BlogexConfig = {
  owner: string;
  targetRepo: string;
  targetBranch: string;
  targetDirectory: string;
};

export type SyncFile = {
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

export type SaveMarkdownResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export type CreateMarkdownResponse = {
  success?: boolean;
  path?: string;
  name?: string;
  markdown?: string;
  message?: string;
  error?: string;
};

export type GetConfigResponse = {
  exists?: boolean;
  config?: Partial<BlogexConfig> | null;
  error?: string;
};

export type SaveConfigResponse = {
  success?: boolean;
  error?: string;
};

type SyncListResponse = {
  files?: SyncFile[];
  error?: string;
};

export type SyncPullResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export type SyncStatusResponse = {
  exists?: boolean;
  error?: string;
};

/** Fetch one page of blogex repositories for the authenticated user. */
export async function fetchRepositoriesPage(page: number, perPage: number) {
  const response = await fetch(
    `/api/github/repositories?page=${page}&per_page=${perPage}`,
  );
  const data = (await response.json()) as RepositoriesResponse;

  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to load repositories.",
    };
  }

  return {
    ok: true as const,
    repositories: data.repositories ?? [],
    page: data.page ?? page,
    perPage: data.perPage ?? perPage,
    totalPages: data.totalPages ?? null,
  };
}

/** Fetch all branches for a repository. */
export async function fetchRepositoryBranches(repoFullName: string) {
  const response = await fetch(
    `/api/github/repositories/branches?repo=${encodeURIComponent(repoFullName)}`,
  );
  const data = (await response.json()) as BranchesResponse;

  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to load branches.",
    };
  }

  return {
    ok: true as const,
    branches: data.branches ?? [],
  };
}

/** Fetch markdown files from the repo _posts directory for a branch. */
export async function fetchRepositoryPosts(repoFullName: string, branchName: string) {
  const response = await fetch(
    `/api/github/repositories/posts?repo=${encodeURIComponent(repoFullName)}&branch=${encodeURIComponent(branchName)}`,
  );
  const data = (await response.json()) as PostFilesResponse;

  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to load markdown files.",
    };
  }

  return {
    ok: true as const,
    files: data.files ?? [],
  };
}

/** Fetch markdown content for a specific file in a repository. */
export async function fetchMarkdownContent(
  repoFullName: string,
  branchName: string,
  filePath: string,
) {
  const response = await fetch(
    `/api/github/repositories/posts/content?repo=${encodeURIComponent(repoFullName)}&branch=${encodeURIComponent(branchName)}&path=${encodeURIComponent(filePath)}`,
  );
  const data = (await response.json()) as MarkdownContentResponse;

  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to load markdown content.",
    };
  }

  return {
    ok: true as const,
    data,
  };
}

/** Save markdown changes and create a commit in the selected repository. */
export async function saveMarkdownContent(payload: {
  repo: string;
  branch: string;
  path: string;
  markdown: string;
  message: string;
}) {
  const response = await fetch("/api/github/repositories/posts/content", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as SaveMarkdownResponse;
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to save markdown file.",
    };
  }

  return {
    ok: true as const,
    data,
  };
}

/** Create a new markdown file in the selected repository branch. */
export async function createMarkdownFile(payload: {
  repo: string;
  branch: string;
  title: string;
}) {
  const response = await fetch("/api/github/repositories/posts/content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as CreateMarkdownResponse;
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to create markdown file.",
    };
  }

  return {
    ok: true as const,
    data,
  };
}

/** Load blogex.config.json for a repository and branch. */
export async function fetchRepositoryConfig(repo: string, branch: string) {
  const response = await fetch(
    `/api/github/repositories/config?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`,
  );
  const data = (await response.json()) as GetConfigResponse;

  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to load blogex.config.json.",
    };
  }

  return {
    ok: true as const,
    data,
  };
}

/** Save blogex.config.json for a repository and branch. */
export async function saveRepositoryConfig(payload: {
  repo: string;
  branch: string;
  config: BlogexConfig;
}) {
  const response = await fetch("/api/github/repositories/config", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as SaveConfigResponse;
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to save blogex.config.json.",
    };
  }

  return {
    ok: true as const,
    data,
  };
}

/** Fetch markdown candidates from the configured source repo for sync. */
export async function fetchSyncMarkdownFiles(payload: {
  sourceRepo: string;
  sourceBranch: string;
  sourceDirectory: string;
}) {
  const response = await fetch(
    `/api/github/repositories/sync?sourceRepo=${encodeURIComponent(payload.sourceRepo)}&sourceBranch=${encodeURIComponent(payload.sourceBranch)}&sourceDirectory=${encodeURIComponent(payload.sourceDirectory)}`,
  );

  const data = (await response.json()) as SyncListResponse;
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to load sync markdown files.",
    };
  }

  return {
    ok: true as const,
    files: data.files ?? [],
  };
}

/** Pull one markdown file from source repo into target repo and commit it. */
export async function pullSyncMarkdown(payload: {
  sourceRepo: string;
  sourceBranch: string;
  sourceDirectory: string;
  sourcePath: string;
  targetRepo: string;
  targetBranch: string;
}) {
  const response = await fetch("/api/github/repositories/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as SyncPullResponse;
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to sync markdown.",
    };
  }

  return {
    ok: true as const,
    data,
  };
}

/** Check if the selected markdown file already exists in the target repo. */
export async function fetchTargetFileSyncStatus(payload: {
  targetRepo: string;
  targetBranch: string;
  targetDirectory: string;
  sourcePath: string;
}) {
  const response = await fetch(
    `/api/github/repositories/sync/status?targetRepo=${encodeURIComponent(payload.targetRepo)}&targetBranch=${encodeURIComponent(payload.targetBranch)}&targetDirectory=${encodeURIComponent(payload.targetDirectory)}&sourcePath=${encodeURIComponent(payload.sourcePath)}`,
  );

  const data = (await response.json()) as SyncStatusResponse;
  if (!response.ok) {
    return {
      ok: false as const,
      error: data.error ?? "Failed to check target sync status.",
    };
  }

  return {
    ok: true as const,
    data,
  };
}

