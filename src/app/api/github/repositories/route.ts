import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";
import {
  buildRepositoryConfigContent,
  getRepositoryInitTemplatePath,
  REPOSITORY_CONFIG_FILE_PATH,
  REPOSITORY_INIT_TARGET_FILE_PATH,
} from "@/lib/repository-init-config";
import {
  createRepositoryConfigCommitMessage,
  createRepositoryInitPostCommitMessage,
} from "@/lib/commit-messages";

type CreateRepositoryPayload = {
  name?: string;
  private?: boolean;
};

type GithubCreateRepositoryResponse = {
  html_url?: string;
  name?: string;
  owner?: {
    login?: string;
  };
  message?: string;
};

type GithubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
};

type GithubApiError = {
  message?: string;
};

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

async function fetchAllGithubRepositories(token: string) {
  const repositories: GithubRepository[] = [];
  let currentPage = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await fetch(
      `https://api.github.com/user/repos?sort=updated&page=${currentPage}&per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "blogex",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return {
        repositories: [],
        error: (await response.json()) as GithubApiError,
        status: response.status,
      };
    }

    const pageRepositories = (await response.json()) as GithubRepository[];
    repositories.push(...pageRepositories);

    const linkHeader = response.headers.get("link") ?? "";
    hasNext = linkHeader.includes('rel="next"');
    currentPage += 1;
  }

  return { repositories, status: 200 as const };
}

async function hasBlogexConfig(token: string, repositoryFullName: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repositoryFullName}/contents/${REPOSITORY_CONFIG_FILE_PATH}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "blogex",
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return { exists: false, status: 404 as const };
  }

  if (!response.ok) {
    return {
      exists: false,
      status: response.status,
      error: (await response.json()) as GithubApiError,
    };
  }

  return { exists: true, status: 200 as const };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  const page = parsePositiveInteger(request.nextUrl.searchParams.get("page"), 1);
  const perPage = Math.min(
    parsePositiveInteger(request.nextUrl.searchParams.get("per_page"), 20),
    100,
  );

  const allRepositoriesResponse = await fetchAllGithubRepositories(token);
  if (allRepositoriesResponse.status !== 200) {
    const response = NextResponse.json(
      {
        error:
          allRepositoriesResponse.error?.message ??
          API_ERRORS.FAILED_FETCH_REPOSITORIES.message,
      },
      { status: allRepositoriesResponse.status },
    );
    if (allRepositoriesResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const matchingRepositories: GithubRepository[] = [];
  const batchSize = 10;

  for (let index = 0; index < allRepositoriesResponse.repositories.length; index += batchSize) {
    const batch = allRepositoriesResponse.repositories.slice(index, index + batchSize);
    const checks = await Promise.all(
      batch.map((repo) => hasBlogexConfig(token, repo.full_name)),
    );

    for (let i = 0; i < checks.length; i += 1) {
      const check = checks[i];

      if (check.exists) {
        matchingRepositories.push(batch[i]);
        continue;
      }

      if (check.status === 401) {
        const response = NextResponse.json(
          { error: check.error?.message ?? API_ERRORS.GITHUB_TOKEN_NO_LONGER_VALID.message },
          { status: 401 },
        );
        return clearAuthCookies(response);
      }
    }
  }

  const totalMatching = matchingRepositories.length;
  const totalPages =
    totalMatching === 0 ? 0 : Math.ceil(totalMatching / perPage);
  const normalizedPage =
    totalPages === 0 ? 1 : Math.min(page, totalPages);
  const start = (normalizedPage - 1) * perPage;
  const paginatedRepositories = matchingRepositories.slice(start, start + perPage);
  const hasPrev = normalizedPage > 1;
  const hasNext = totalPages > 0 && normalizedPage < totalPages;

  return NextResponse.json(
    {
      repositories: paginatedRepositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
      })),
      page: normalizedPage,
      perPage,
      hasNext,
      hasPrev,
      totalPages,
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  let payload: CreateRepositoryPayload;

  try {
    payload = (await request.json()) as CreateRepositoryPayload;
  } catch {
    return jsonError("INVALID_JSON_PAYLOAD");
  }

  const name = payload.name?.trim();
  const isPrivate = Boolean(payload.private);

  if (!name) {
    return jsonError("REPOSITORY_NAME_REQUIRED");
  }

  let defaultPostContent: string;
  try {
    const templatePath = getRepositoryInitTemplatePath();
    defaultPostContent = await readFile(templatePath, "utf8");
  } catch {
    return jsonError("FAILED_LOAD_DEFAULT_MARKDOWN_TEMPLATE");
  }

  const githubResponse = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "blogex",
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
    }),
    cache: "no-store",
  });

  const githubData =
    (await githubResponse.json()) as GithubCreateRepositoryResponse;

  if (!githubResponse.ok) {
    const response = NextResponse.json(
      { error: githubData.message ?? API_ERRORS.FAILED_CREATE_REPOSITORY.message },
      { status: githubResponse.status },
    );
    if (githubResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const owner = githubData.owner?.login;
  const repositoryName = githubData.name;
  let configInitialized = false;
  let postsInitialized = false;
  let warning: string | undefined;

  if (owner && repositoryName) {
    const blogexConfigResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repositoryName}/contents/${REPOSITORY_CONFIG_FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "blogex",
        },
        body: JSON.stringify({
          message: createRepositoryConfigCommitMessage(),
          content: Buffer.from(buildRepositoryConfigContent(owner)).toString(
            "base64",
          ),
        }),
        cache: "no-store",
      },
    );

    configInitialized = blogexConfigResponse.ok;

    if (!blogexConfigResponse.ok) {
      const configError = (await blogexConfigResponse.json()) as {
        message?: string;
      };
      if (blogexConfigResponse.status === 401) {
        const response = NextResponse.json(
          { error: configError.message ?? API_ERRORS.GITHUB_TOKEN_NO_LONGER_VALID.message },
          { status: 401 },
        );
        return clearAuthCookies(response);
      }
      warning =
        configError.message ??
        "Repository was created but blogex.config.json initialization failed.";
    }

    const createPostsDirectoryResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repositoryName}/contents/${REPOSITORY_INIT_TARGET_FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "blogex",
        },
        body: JSON.stringify({
          message: createRepositoryInitPostCommitMessage(),
          content: Buffer.from(defaultPostContent).toString("base64"),
        }),
        cache: "no-store",
      },
    );

    postsInitialized = createPostsDirectoryResponse.ok;

    if (!createPostsDirectoryResponse.ok) {
      const postsError = (await createPostsDirectoryResponse.json()) as {
        message?: string;
      };
      if (createPostsDirectoryResponse.status === 401) {
        const response = NextResponse.json(
          { error: postsError.message ?? API_ERRORS.GITHUB_TOKEN_NO_LONGER_VALID.message },
          { status: 401 },
        );
        return clearAuthCookies(response);
      }
      warning =
        warning ??
        postsError.message ??
        "Repository was created but _posts initialization failed.";
    }
  } else {
    warning = "Repository was created but _posts initialization metadata was missing.";
  }

  return NextResponse.json(
    {
      success: true,
      url: githubData.html_url,
      configInitialized,
      postsInitialized,
      warning,
    },
    { status: 201 },
  );
}
