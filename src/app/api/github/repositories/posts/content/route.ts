import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import {
  buildInitialMarkdownFromTitle,
  normalizeMarkdownFileName,
  titleToMarkdownFileName,
} from "@/lib/markdown-post";
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();
  const branch = request.nextUrl.searchParams.get("branch")?.trim();
  const filePath = request.nextUrl.searchParams.get("path")?.trim();

  if (!repo) {
    return NextResponse.json(
      { error: "Query param `repo` must be in `owner/name` format." },
      { status: 400 },
    );
  }

  if (!branch) {
    return NextResponse.json(
      { error: "Query param `branch` is required." },
      { status: 400 },
    );
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return NextResponse.json(
      { error: "Query param `path` must target a markdown file in _posts." },
      { status: 400 },
    );
  }

  const parsedRepo = parseRepository(repo);
  if (!parsedRepo) {
    return NextResponse.json(
      { error: "Invalid repository format." },
      { status: 400 },
    );
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
      { error: errorData.message ?? "Failed to fetch markdown content." },
      { status: githubResponse.status },
    );
    if (githubResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const githubData = (await githubResponse.json()) as GithubFileResponse;

  if (githubData.type !== "file" || githubData.encoding !== "base64" || !githubData.content) {
    return NextResponse.json(
      { error: "Unsupported markdown file response format." },
      { status: 500 },
    );
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: UpdateMarkdownPayload;
  try {
    payload = (await request.json()) as UpdateMarkdownPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const repo = payload.repo?.trim();
  const branch = payload.branch?.trim();
  const filePath = payload.path?.trim();
  const markdown = payload.markdown;
  const commitMessage =
    payload.message?.trim() || createUpdateMarkdownCommitMessage(payload.path);

  if (!repo) {
    return NextResponse.json(
      { error: "Field `repo` must be in `owner/name` format." },
      { status: 400 },
    );
  }

  if (!branch) {
    return NextResponse.json(
      { error: "Field `branch` is required." },
      { status: 400 },
    );
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return NextResponse.json(
      { error: "Field `path` must target a markdown file in _posts." },
      { status: 400 },
    );
  }

  if (typeof markdown !== "string") {
    return NextResponse.json(
      { error: "Field `markdown` must be a string." },
      { status: 400 },
    );
  }

  const parsedRepo = parseRepository(repo);
  if (!parsedRepo) {
    return NextResponse.json(
      { error: "Invalid repository format." },
      { status: 400 },
    );
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
      { error: errorData.message ?? "Failed to fetch current file metadata." },
      { status: currentFileResponse.status },
    );
    if (currentFileResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const currentFile = (await currentFileResponse.json()) as GithubFileResponse;
  if (!currentFile.sha) {
    return NextResponse.json(
      { error: "Missing file sha from GitHub response." },
      { status: 500 },
    );
  }

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
        content: Buffer.from(markdown).toString("base64"),
        sha: currentFile.sha,
        branch,
      }),
      cache: "no-store",
    },
  );

  if (!updateResponse.ok) {
    const errorData = (await updateResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? "Failed to update markdown file." },
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: CreateMarkdownPayload;
  try {
    payload = (await request.json()) as CreateMarkdownPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
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
    return NextResponse.json(
      { error: "Field `repo` must be in `owner/name` format." },
      { status: 400 },
    );
  }

  if (!branch) {
    return NextResponse.json(
      { error: "Field `branch` is required." },
      { status: 400 },
    );
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return NextResponse.json(
      { error: "Field `title` must produce a valid markdown file name." },
      { status: 400 },
    );
  }

  const parsedRepo = parseRepository(repo);
  if (!parsedRepo) {
    return NextResponse.json(
      { error: "Invalid repository format." },
      { status: 400 },
    );
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
      { error: errorData.message ?? "GitHub token is no longer valid." },
      { status: 401 },
    );
    return clearAuthCookies(response);
  }

  if (existingResponse.status === 200) {
    return NextResponse.json(
      { error: "A markdown file with this name already exists." },
      { status: 409 },
    );
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
      { error: errorData.message ?? "Failed to create markdown file." },
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: RenameMarkdownPayload;
  try {
    payload = (await request.json()) as RenameMarkdownPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const repo = payload.repo?.trim();
  const branch = payload.branch?.trim();
  const filePath = payload.path?.trim();
  const normalizedFileName = normalizeMarkdownFileName(payload.nextName ?? "");
  const nextPath = normalizedFileName ? `_posts/${normalizedFileName}` : null;

  if (!repo) {
    return NextResponse.json(
      { error: "Field `repo` must be in `owner/name` format." },
      { status: 400 },
    );
  }

  if (!branch) {
    return NextResponse.json(
      { error: "Field `branch` is required." },
      { status: 400 },
    );
  }

  if (!filePath || !validateMarkdownPath(filePath)) {
    return NextResponse.json(
      { error: "Field `path` must target a markdown file in _posts." },
      { status: 400 },
    );
  }

  if (!nextPath || !validateMarkdownPath(nextPath)) {
    return NextResponse.json(
      { error: "Field `nextName` must be a valid markdown filename." },
      { status: 400 },
    );
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
    return NextResponse.json(
      { error: "Invalid repository format." },
      { status: 400 },
    );
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
      { error: errorData.message ?? "Failed to fetch source file metadata." },
      { status: currentFileResponse.status },
    );
    if (currentFileResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const currentFile = (await currentFileResponse.json()) as GithubFileResponse;

  if (!currentFile.sha || !currentFile.content || currentFile.encoding !== "base64") {
    return NextResponse.json(
      { error: "Unsupported source markdown file response format." },
      { status: 500 },
    );
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
      { error: errorData.message ?? "GitHub token is no longer valid." },
      { status: 401 },
    );
    return clearAuthCookies(response);
  }

  if (existingTargetResponse.status === 200) {
    return NextResponse.json(
      { error: "A markdown file with this name already exists." },
      { status: 409 },
    );
  }

  if (existingTargetResponse.status !== 404) {
    const errorData = (await existingTargetResponse.json()) as { message?: string };
    return NextResponse.json(
      { error: errorData.message ?? "Failed to check destination filename." },
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
          payload.message?.trim() || createRenameMarkdownCommitMessage(normalizedFileName),
        content: currentFile.content.replace(/\n/g, ""),
        branch,
      }),
      cache: "no-store",
    },
  );

  if (!putResponse.ok) {
    const errorData = (await putResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? "Failed to create renamed markdown file." },
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
      name: normalizedFileName,
      message: "Markdown file renamed and committed.",
    },
    { status: 200 },
  );
}
