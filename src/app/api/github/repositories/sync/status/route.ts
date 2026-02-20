import { NextRequest, NextResponse } from "next/server";
import { OAUTH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";

type GithubApiError = {
  message?: string;
  sha?: string;
};

function parseRepo(repo: string) {
  if (!repo.includes("/")) {
    return null;
  }

  const [owner, name] = repo.split("/", 2);
  if (!owner || !name) {
    return null;
  }

  return { owner, name };
}

function encodeContentPath(filePath: string) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeDirectory(directory: string) {
  return directory.replace(/^\/+|\/+$/g, "") || "_posts";
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(OAUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  const targetRepo = request.nextUrl.searchParams.get("targetRepo")?.trim();
  const targetBranch = request.nextUrl.searchParams.get("targetBranch")?.trim();
  const targetDirectory = normalizeDirectory(
    request.nextUrl.searchParams.get("targetDirectory")?.trim() || "_posts",
  );
  const sourcePath = request.nextUrl.searchParams.get("sourcePath")?.trim();

  if (!targetRepo || !targetBranch || !sourcePath) {
    return jsonError("QUERY_TARGET_REPO_TARGET_BRANCH_SOURCE_PATH_REQUIRED");
  }

  if (!sourcePath.endsWith(".md")) {
    return jsonError("SOURCE_PATH_MARKDOWN_FILE_REQUIRED");
  }

  const parsedTarget = parseRepo(targetRepo);
  if (!parsedTarget) {
    return jsonError("TARGET_REPO_OWNER_NAME_REQUIRED");
  }

  const fileName = sourcePath.split("/").pop();
  if (!fileName) {
    return jsonError("INVALID_SOURCE_PATH");
  }

  const targetPath = `${targetDirectory}/${fileName}`;
  const encodedTargetPath = encodeContentPath(targetPath);

  const githubResponse = await fetch(
    `https://api.github.com/repos/${parsedTarget.owner}/${parsedTarget.name}/contents/${encodedTargetPath}?ref=${encodeURIComponent(targetBranch)}`,
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

  if (githubResponse.status === 404) {
    return NextResponse.json(
      { exists: false, targetPath },
      { status: 200 },
    );
  }

  if (!githubResponse.ok) {
    const errorData = (await githubResponse.json()) as GithubApiError;
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_CHECK_TARGET_MARKDOWN_FILE.message },
      { status: githubResponse.status },
    );

    if (githubResponse.status === 401) {
      return clearAuthCookies(response);
    }

    return response;
  }

  const data = (await githubResponse.json()) as GithubApiError;

  return NextResponse.json(
    {
      exists: true,
      targetPath,
      sha: data.sha,
    },
    { status: 200 },
  );
}
