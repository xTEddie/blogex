import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();
  const branch = request.nextUrl.searchParams.get("branch")?.trim();

  if (!repo || !branch) {
    return NextResponse.json(
      { error: "Query params repo and branch are required." },
      { status: 400 },
    );
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
      { error: result.error?.message ?? "Failed to load blogex config." },
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: UpdateConfigPayload;

  try {
    payload = (await request.json()) as UpdateConfigPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const repo = payload.repo?.trim();
  const branch = payload.branch?.trim();

  if (!repo || !branch) {
    return NextResponse.json(
      { error: "Fields repo and branch are required." },
      { status: 400 },
    );
  }

  if (!payload.config || typeof payload.config !== "object") {
    return NextResponse.json(
      { error: "Field config is required." },
      { status: 400 },
    );
  }

  const existing = await fetchExistingConfig(token, repo, branch);

  if (existing.status !== 200 && existing.status !== 404) {
    const response = NextResponse.json(
      { error: existing.error?.message ?? "Failed to check existing config." },
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
        message: payload.message?.trim() || "chore: update blogex config",
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
      { error: putData.message ?? "Failed to save blogex config." },
      { status: putResponse.status },
    );

    if (putResponse.status === 401) {
      return clearAuthCookies(response);
    }

    return response;
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
