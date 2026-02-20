import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";
import {
  buildInitialMarkdownFromTitle,
  normalizeMarkdownFileName,
  titleToMarkdownFileName,
} from "@/lib/markdown-post";
import { applyLineEnding, detectLineEnding } from "@/lib/line-endings";
import {
  createAddMarkdownCommitMessage,
  createDeleteOldMarkdownAfterRenameCommitMessage,
  createRenameMarkdownCommitMessage,
  createUpdateMarkdownCommitMessage,
} from "@/lib/commit-messages";

type GithubFileResponse = {
  type: "file";
  name: string;
  path: string;
  sha?: string;
  encoding?: string;
  content?: string;
};

type UpdateMarkdownPayload = {
  repo?: string;
  branch?: string;
  path?: string;
  markdown?: string;
  message?: string;
};

type CreateMarkdownPayload = {
  repo?: string;
  branch?: string;
  title?: string;
  markdown?: string;
  message?: string;
};

type RenameMarkdownPayload = {
  repo?: string;
  branch?: string;
  path?: string;
  nextName?: string;
  message?: string;
};

function parseRepository(repo: string) {
  if (!repo.includes("/")) {
    return null;
  }

  const [owner, name] = repo.split("/", 2);
  if (!owner || !name) {
    return null;
  }

  return { owner, name };
}

function validateMarkdownPath(filePath: string) {
  return filePath.startsWith("_posts/") && filePath.endsWith(".md");
}

function encodeContentPath(filePath: string) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();
  const branch = request.nextUrl.searchParams.get("branch")?.trim();
  const filePath = request.nextUrl.searchParams.get("path")?.trim();

  if (!repo) {
    return jsonError("REPO_QUERY_OWNER_NAME_REQUIRED");
  }

  if (!branch) {
    return jsonError("BRANCH_QUERY_REQUIRED");
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return jsonError("PATH_QUERY_POSTS_MARKDOWN_REQUIRED");
  }

  const parsedRepo = parseRepository(repo);
  if (!parsedRepo) {
    return jsonError("INVALID_REPOSITORY_FORMAT");
  }

  const { owner, name } = parsedRepo;
  const encodedPath = encodeContentPath(filePath);

  const githubResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
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

  if (!githubResponse.ok) {
    const errorData = (await githubResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_FETCH_MARKDOWN_CONTENT.message },
      { status: githubResponse.status },
    );
    if (githubResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const githubData = (await githubResponse.json()) as GithubFileResponse;

  if (githubData.type !== "file" || githubData.encoding !== "base64" || !githubData.content) {
    return jsonError("UNSUPPORTED_MARKDOWN_FILE_RESPONSE_FORMAT");
  }

  const markdown = Buffer.from(githubData.content, "base64").toString("utf8");

  return NextResponse.json(
    {
      name: githubData.name,
      path: githubData.path,
      markdown,
    },
    { status: 200 },
  );
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  let payload: UpdateMarkdownPayload;
  try {
    payload = (await request.json()) as UpdateMarkdownPayload;
  } catch {
    return jsonError("INVALID_JSON_PAYLOAD");
  }

  const repo = payload.repo?.trim();
  const branch = payload.branch?.trim();
  const filePath = payload.path?.trim();
  const markdown = payload.markdown;
  const commitMessage =
    payload.message?.trim() || createUpdateMarkdownCommitMessage(payload.path);

  if (!repo) {
    return jsonError("REPO_FIELD_OWNER_NAME_REQUIRED");
  }

  if (!branch) {
    return jsonError("BRANCH_FIELD_REQUIRED");
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return jsonError("PATH_FIELD_POSTS_MARKDOWN_REQUIRED");
  }

  if (typeof markdown !== "string") {
    return jsonError("MARKDOWN_FIELD_STRING_REQUIRED");
  }

  const parsedRepo = parseRepository(repo);
  if (!parsedRepo) {
    return jsonError("INVALID_REPOSITORY_FORMAT");
  }

  const { owner, name } = parsedRepo;
  const encodedPath = encodeContentPath(filePath);

  const currentFileResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
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

  if (!currentFileResponse.ok) {
    const errorData = (await currentFileResponse.json()) as { message?: string };
    const response = NextResponse.json(
      {
        error:
          errorData.message ?? API_ERRORS.FAILED_FETCH_CURRENT_FILE_METADATA.message,
      },
      { status: currentFileResponse.status },
    );
    if (currentFileResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const currentFile = (await currentFileResponse.json()) as GithubFileResponse;
  if (!currentFile.sha) {
    return jsonError("MISSING_FILE_SHA");
  }

  const currentMarkdown =
    currentFile.encoding === "base64" && typeof currentFile.content === "string"
      ? Buffer.from(currentFile.content.replace(/\n/g, ""), "base64").toString("utf8")
      : "";
  // Preserve existing file line endings so edits do not flip CRLF/LF unexpectedly.
  const currentLineEnding = detectLineEnding(currentMarkdown);
  const normalizedMarkdown = applyLineEnding(markdown, currentLineEnding);

  const updateResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedPath}`,
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
        message: commitMessage,
        content: Buffer.from(normalizedMarkdown).toString("base64"),
        sha: currentFile.sha,
        branch,
      }),
      cache: "no-store",
    },
  );

  if (!updateResponse.ok) {
    const errorData = (await updateResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_UPDATE_MARKDOWN_FILE.message },
      { status: updateResponse.status },
    );
    if (updateResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  return NextResponse.json(
    {
      success: true,
      path: filePath,
      message: "Markdown file updated and committed.",
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  let payload: CreateMarkdownPayload;
  try {
    payload = (await request.json()) as CreateMarkdownPayload;
  } catch {
    return jsonError("INVALID_JSON_PAYLOAD");
  }

  const repo = payload.repo?.trim();
  const branch = payload.branch?.trim();
  const title = payload.title?.trim() ?? "";
  const normalizedFileName = titleToMarkdownFileName(title);
  const filePath = normalizedFileName ? `_posts/${normalizedFileName}` : null;
  const markdown =
    typeof payload.markdown === "string"
      ? payload.markdown
      : buildInitialMarkdownFromTitle(title);
  const commitMessage =
    payload.message?.trim() || createAddMarkdownCommitMessage(normalizedFileName);

  if (!repo) {
    return jsonError("REPO_FIELD_OWNER_NAME_REQUIRED");
  }

  if (!branch) {
    return jsonError("BRANCH_FIELD_REQUIRED");
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return jsonError("TITLE_FIELD_INVALID_MARKDOWN_FILENAME");
  }

  const parsedRepo = parseRepository(repo);
  if (!parsedRepo) {
    return jsonError("INVALID_REPOSITORY_FORMAT");
  }

  const { owner, name } = parsedRepo;
  const encodedPath = encodeContentPath(filePath);

  const existingResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
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

  if (existingResponse.status === 401) {
    const errorData = (await existingResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.GITHUB_TOKEN_NO_LONGER_VALID.message },
      { status: 401 },
    );
    return clearAuthCookies(response);
  }

  if (existingResponse.status === 200) {
    return jsonError("MARKDOWN_FILE_ALREADY_EXISTS");
  }

  const createResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedPath}`,
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
        message: commitMessage,
        content: Buffer.from(markdown).toString("base64"),
        branch,
      }),
      cache: "no-store",
    },
  );

  if (!createResponse.ok) {
    const errorData = (await createResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_CREATE_MARKDOWN_FILE.message },
      { status: createResponse.status },
    );
    if (createResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  return NextResponse.json(
    {
      success: true,
      path: filePath,
      name: normalizedFileName,
      markdown,
      message: "Markdown file created and committed.",
    },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  let payload: RenameMarkdownPayload;
  try {
    payload = (await request.json()) as RenameMarkdownPayload;
  } catch {
    return jsonError("INVALID_JSON_PAYLOAD");
  }

  const repo = payload.repo?.trim();
  const branch = payload.branch?.trim();
  const filePath = payload.path?.trim();
  const normalizedFileName = normalizeMarkdownFileName(payload.nextName ?? "");
  const nextPath = normalizedFileName ? `_posts/${normalizedFileName}` : null;

  if (!repo) {
    return jsonError("REPO_FIELD_OWNER_NAME_REQUIRED");
  }

  if (!branch) {
    return jsonError("BRANCH_FIELD_REQUIRED");
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return jsonError("PATH_FIELD_POSTS_MARKDOWN_REQUIRED");
  }

  if (!nextPath || !validateMarkdownPath(nextPath)) {
    return jsonError("NEXT_NAME_FIELD_INVALID_MARKDOWN_FILENAME");
  }

  const nextFileName = nextPath.split("/").pop();
  if (!nextFileName) {
    return jsonError("INVALID_TARGET_MARKDOWN_FILENAME");
  }

  if (nextPath === filePath) {
    return NextResponse.json(
      {
        success: true,
        path: filePath,
        name: normalizedFileName,
        message: "Filename is unchanged.",
      },
      { status: 200 },
    );
  }

  const parsedRepo = parseRepository(repo);
  if (!parsedRepo) {
    return jsonError("INVALID_REPOSITORY_FORMAT");
  }

  const { owner, name } = parsedRepo;
  const encodedCurrentPath = encodeContentPath(filePath);
  const encodedNextPath = encodeContentPath(nextPath);

  const currentFileResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedCurrentPath}?ref=${encodeURIComponent(branch)}`,
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

  if (!currentFileResponse.ok) {
    const errorData = (await currentFileResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_FETCH_SOURCE_FILE_METADATA.message },
      { status: currentFileResponse.status },
    );
    if (currentFileResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const currentFile = (await currentFileResponse.json()) as GithubFileResponse;

  if (!currentFile.sha || !currentFile.content || currentFile.encoding !== "base64") {
    return jsonError("UNSUPPORTED_SOURCE_MARKDOWN_FILE_RESPONSE_FORMAT");
  }

  const existingTargetResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedNextPath}?ref=${encodeURIComponent(branch)}`,
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

  if (existingTargetResponse.status === 401) {
    const errorData = (await existingTargetResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.GITHUB_TOKEN_NO_LONGER_VALID.message },
      { status: 401 },
    );
    return clearAuthCookies(response);
  }

  if (existingTargetResponse.status === 200) {
    return jsonError("MARKDOWN_FILE_ALREADY_EXISTS");
  }

  if (existingTargetResponse.status !== 404) {
    const errorData = (await existingTargetResponse.json()) as { message?: string };
    return NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_CHECK_DESTINATION_FILENAME.message },
      { status: existingTargetResponse.status },
    );
  }

  const putResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedNextPath}`,
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
        message:
          payload.message?.trim() || createRenameMarkdownCommitMessage(nextFileName),
        content: currentFile.content.replace(/\n/g, ""),
        branch,
      }),
      cache: "no-store",
    },
  );

  if (!putResponse.ok) {
    const errorData = (await putResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_CREATE_RENAMED_MARKDOWN_FILE.message },
      { status: putResponse.status },
    );
    if (putResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const deleteResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/${encodedCurrentPath}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "blogex",
      },
      body: JSON.stringify({
        message: createDeleteOldMarkdownAfterRenameCommitMessage(filePath),
        sha: currentFile.sha,
        branch,
      }),
      cache: "no-store",
    },
  );

  if (!deleteResponse.ok) {
    const errorData = (await deleteResponse.json()) as { message?: string };
    const response = NextResponse.json(
      {
        error:
          errorData.message ??
          "Renamed file was created but deleting old file failed. Please clean up manually.",
      },
      { status: deleteResponse.status },
    );
    if (deleteResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  return NextResponse.json(
    {
      success: true,
      path: nextPath,
      name: nextFileName,
      message: "Markdown file renamed and committed.",
    },
    { status: 200 },
  );
}
