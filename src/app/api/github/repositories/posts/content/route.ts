import { NextRequest, NextResponse } from "next/server";

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
    return NextResponse.json(
      { error: errorData.message ?? "Failed to fetch markdown content." },
      { status: githubResponse.status },
    );
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
    payload.message?.trim() || `chore: update ${payload.path ?? "markdown file"}`;

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
    return NextResponse.json(
      { error: errorData.message ?? "Failed to fetch current file metadata." },
      { status: currentFileResponse.status },
    );
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
    return NextResponse.json(
      { error: errorData.message ?? "Failed to update markdown file." },
      { status: updateResponse.status },
    );
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
