import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";
import { createUpdateBlogexConfigCommitMessage } from "@/lib/commit-messages";
import { REPOSITORY_CONFIG_FILE_PATH } from "@/lib/repository-init-config";

type GithubContentResponse = {
  sha?: string;
  content?: string;
  encoding?: string;
  message?: string;
};

type GithubApiError = {
  message?: string;
};

type BlogexConfig = {
  owner?: string;
  targetRepo?: string;
  targetBranch?: string;
  targetDirectory?: string;
};

type UpdateConfigPayload = {
  repo?: string;
  branch?: string;
  config?: BlogexConfig;
  message?: string;
};

function getGithubHeaders(token: string, withJson = false) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "blogex",
  };
}

function decodeGithubContent(content: string, encoding?: string) {
  if (encoding === "base64") {
    return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
  }

  return content;
}

async function fetchExistingConfig(token: string, repo: string, branch: string) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${REPOSITORY_CONFIG_FILE_PATH}?ref=${encodeURIComponent(branch)}`,
    {
      headers: getGithubHeaders(token),
      cache: "no-store",
    },
  );

  if (response.status === 404) {
    return { exists: false as const, status: 404 as const };
  }

  if (!response.ok) {
    return {
      exists: false as const,
      status: response.status,
      error: (await response.json()) as GithubApiError,
    };
  }

  const data = (await response.json()) as GithubContentResponse;
  const decodedContent = decodeGithubContent(data.content ?? "", data.encoding);

  let parsedConfig: BlogexConfig | null = null;
  try {
    parsedConfig = JSON.parse(decodedContent) as BlogexConfig;
  } catch {
    parsedConfig = null;
  }

  return {
    exists: true as const,
    status: 200 as const,
    sha: data.sha,
    rawContent: decodedContent,
    parsedConfig,
  };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();
  const branch = request.nextUrl.searchParams.get("branch")?.trim();

  if (!repo || !branch) {
    return jsonError("QUERY_REPO_AND_BRANCH_REQUIRED");
  }

  const result = await fetchExistingConfig(token, repo, branch);

  if (result.status === 404) {
    return NextResponse.json(
      {
        exists: false,
        config: null,
      },
      { status: 200 },
    );
  }

  if (result.status !== 200) {
    const response = NextResponse.json(
      { error: result.error?.message ?? API_ERRORS.FAILED_LOAD_BLOGEX_CONFIG.message },
      { status: result.status },
    );

    if (result.status === 401) {
      return clearAuthCookies(response);
    }

    return response;
  }

  return NextResponse.json(
    {
      exists: true,
      config: result.parsedConfig,
      rawContent: result.rawContent,
      sha: result.sha,
    },
    { status: 200 },
  );
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  let payload: UpdateConfigPayload;

  try {
    payload = (await request.json()) as UpdateConfigPayload;
  } catch {
    return jsonError("INVALID_JSON_PAYLOAD");
  }

  const repo = payload.repo?.trim();
  const branch = payload.branch?.trim();

  if (!repo || !branch) {
    return jsonError("FIELDS_REPO_AND_BRANCH_REQUIRED");
  }

  if (!payload.config || typeof payload.config !== "object") {
    return jsonError("FIELD_CONFIG_REQUIRED");
  }

  const existing = await fetchExistingConfig(token, repo, branch);

  if (existing.status !== 200 && existing.status !== 404) {
    const response = NextResponse.json(
      { error: existing.error?.message ?? API_ERRORS.FAILED_CHECK_EXISTING_CONFIG.message },
      { status: existing.status },
    );

    if (existing.status === 401) {
      return clearAuthCookies(response);
    }

    return response;
  }

  const putResponse = await fetch(
    `https://api.github.com/repos/${repo}/contents/${REPOSITORY_CONFIG_FILE_PATH}`,
    {
      method: "PUT",
      headers: getGithubHeaders(token, true),
      body: JSON.stringify({
        message: payload.message?.trim() || createUpdateBlogexConfigCommitMessage(),
        content: Buffer.from(`${JSON.stringify(payload.config, null, 2)}\n`).toString(
          "base64",
        ),
        branch,
        ...(existing.status === 200 && existing.sha ? { sha: existing.sha } : {}),
      }),
      cache: "no-store",
    },
  );

  const putData = (await putResponse.json()) as GithubApiError;

  if (!putResponse.ok) {
    const response = NextResponse.json(
      { error: putData.message ?? API_ERRORS.FAILED_SAVE_BLOGEX_CONFIG.message },
      { status: putResponse.status },
    );

    if (putResponse.status === 401) {
      return clearAuthCookies(response);
    }

    return response;
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
