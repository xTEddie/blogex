import { NextRequest, NextResponse } from "next/server";
import { OAUTH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";
import { createSyncMarkdownCommitMessage } from "@/lib/commit-messages";
import {
  GITHUB_API_BASE_URL,
  getGithubHeaders,
} from "@/lib/github-api-config";

type GithubContentItem = {
  type: "file" | "dir";
  name: string;
  path: string;
  size: number;
  sha?: string;
  encoding?: string;
  content?: string;
  message?: string;
};

type GithubApiError = {
  message?: string;
};

type SyncPayload = {
  sourceRepo?: string;
  sourceBranch?: string;
  sourceDirectory?: string;
  sourcePath?: string;
  targetRepo?: string;
  targetBranch?: string;
  message?: string;
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

export async function GET(request: NextRequest) {
  const token = request.cookies.get(OAUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  const sourceRepo = request.nextUrl.searchParams.get("sourceRepo")?.trim();
  const sourceBranch = request.nextUrl.searchParams.get("sourceBranch")?.trim();
  const sourceDirectory =
    request.nextUrl.searchParams.get("sourceDirectory")?.trim() || "_posts";

  if (!sourceRepo || !sourceBranch) {
    return jsonError("QUERY_SOURCE_REPO_SOURCE_BRANCH_REQUIRED");
  }

  const parsedRepo = parseRepo(sourceRepo);
  if (!parsedRepo) {
    return jsonError("SOURCE_REPO_OWNER_NAME_REQUIRED");
  }

  const githubResponse = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${parsedRepo.owner}/${parsedRepo.name}/contents/${encodeContentPath(sourceDirectory)}?ref=${encodeURIComponent(sourceBranch)}`,
    {
      headers: getGithubHeaders(token),
      cache: "no-store",
    },
  );

  if (githubResponse.status === 404) {
    return NextResponse.json({ files: [] }, { status: 200 });
  }

  if (!githubResponse.ok) {
    const errorData = (await githubResponse.json()) as GithubApiError;
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_FETCH_SOURCE_MARKDOWN_FILES.message },
      { status: githubResponse.status },
    );
    if (githubResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const data = (await githubResponse.json()) as GithubContentItem[];
  const files = data
    .filter((item) => item.type === "file" && item.name.endsWith(".md"))
    .map((item) => ({
      name: item.name,
      path: item.path,
      size: item.size,
    }));

  return NextResponse.json({ files }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(OAUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  let payload: SyncPayload;

  try {
    payload = (await request.json()) as SyncPayload;
  } catch {
    return jsonError("INVALID_JSON_PAYLOAD");
  }

  const sourceRepo = payload.sourceRepo?.trim();
  const sourceBranch = payload.sourceBranch?.trim();
  const sourceDirectory = payload.sourceDirectory?.trim() || "_posts";
  const sourcePath = payload.sourcePath?.trim();
  const targetRepo = payload.targetRepo?.trim();
  const targetBranch = payload.targetBranch?.trim();

  if (!sourceRepo || !sourceBranch || !sourcePath) {
    return jsonError("FIELDS_SOURCE_REPO_SOURCE_BRANCH_SOURCE_PATH_REQUIRED");
  }

  if (!targetRepo || !targetBranch) {
    return jsonError("FIELDS_TARGET_REPO_TARGET_BRANCH_REQUIRED");
  }

  if (!sourcePath.endsWith(".md") || !sourcePath.startsWith(`${sourceDirectory}/`)) {
    return jsonError("SOURCE_PATH_MARKDOWN_INSIDE_SOURCE_DIRECTORY_REQUIRED");
  }

  const parsedSource = parseRepo(sourceRepo);
  const parsedTarget = parseRepo(targetRepo);

  if (!parsedSource || !parsedTarget) {
    return jsonError("REPOSITORY_FIELDS_OWNER_NAME_REQUIRED");
  }

  const encodedSourcePath = encodeContentPath(sourcePath);
  const sourceFileResponse = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${parsedSource.owner}/${parsedSource.name}/contents/${encodedSourcePath}?ref=${encodeURIComponent(sourceBranch)}`,
    {
      headers: getGithubHeaders(token),
      cache: "no-store",
    },
  );

  if (!sourceFileResponse.ok) {
    const errorData = (await sourceFileResponse.json()) as GithubApiError;
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_FETCH_SOURCE_MARKDOWN_CONTENT.message },
      { status: sourceFileResponse.status },
    );
    if (sourceFileResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const sourceFile = (await sourceFileResponse.json()) as GithubContentItem;
  if (sourceFile.type !== "file" || sourceFile.encoding !== "base64" || !sourceFile.content) {
    return jsonError("UNSUPPORTED_SOURCE_MARKDOWN_FORMAT");
  }

  const markdown = Buffer.from(sourceFile.content.replace(/\n/g, ""), "base64").toString(
    "utf8",
  );
  const sourceFileName = sourcePath.split("/").pop();
  if (!sourceFileName) {
    return jsonError("INVALID_SOURCE_FILE_PATH");
  }

  const targetPath = `_posts/${sourceFileName}`;
  const encodedTargetPath = encodeContentPath(targetPath);

  const existingTargetResponse = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${parsedTarget.owner}/${parsedTarget.name}/contents/${encodedTargetPath}?ref=${encodeURIComponent(targetBranch)}`,
    {
      headers: getGithubHeaders(token),
      cache: "no-store",
    },
  );

  let existingSha: string | undefined;
  if (existingTargetResponse.ok) {
    const existingData = (await existingTargetResponse.json()) as GithubContentItem;
    existingSha = existingData.sha;
  } else if (existingTargetResponse.status !== 404) {
    const errorData = (await existingTargetResponse.json()) as GithubApiError;
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_CHECK_TARGET_FILE.message },
      { status: existingTargetResponse.status },
    );
    if (existingTargetResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const putResponse = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${parsedTarget.owner}/${parsedTarget.name}/contents/${encodedTargetPath}`,
    {
      method: "PUT",
      headers: getGithubHeaders(token, { withJson: true }),
      body: JSON.stringify({
        message:
          payload.message?.trim() ||
          createSyncMarkdownCommitMessage(sourceFileName, sourceRepo),
        // Keep source content bytes as-is on pull so current repo matches source CRLF/LF.
        content: Buffer.from(markdown).toString("base64"),
        branch: targetBranch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
      cache: "no-store",
    },
  );

  const putData = (await putResponse.json()) as GithubApiError;

  if (!putResponse.ok) {
    const response = NextResponse.json(
      { error: putData.message ?? API_ERRORS.FAILED_SYNC_MARKDOWN_FILE.message },
      { status: putResponse.status },
    );
    if (putResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  return NextResponse.json(
    {
      success: true,
      path: targetPath,
      message: `${sourceFileName} synced to ${targetRepo} (${targetBranch}).`,
    },
    { status: 200 },
  );
}
