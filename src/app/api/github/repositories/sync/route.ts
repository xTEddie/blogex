import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { createSyncMarkdownCommitMessage } from "@/lib/commit-messages";

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

function getGithubHeaders(token: string, withJson = false) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "blogex",
  };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceRepo = request.nextUrl.searchParams.get("sourceRepo")?.trim();
  const sourceBranch = request.nextUrl.searchParams.get("sourceBranch")?.trim();
  const sourceDirectory =
    request.nextUrl.searchParams.get("sourceDirectory")?.trim() || "_posts";

  if (!sourceRepo || !sourceBranch) {
    return NextResponse.json(
      { error: "Query params sourceRepo and sourceBranch are required." },
      { status: 400 },
    );
  }

  const parsedRepo = parseRepo(sourceRepo);
  if (!parsedRepo) {
    return NextResponse.json(
      { error: "sourceRepo must be in owner/name format." },
      { status: 400 },
    );
  }

  const githubResponse = await fetch(
    `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.name}/contents/${encodeContentPath(sourceDirectory)}?ref=${encodeURIComponent(sourceBranch)}`,
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
      { error: errorData.message ?? "Failed to fetch source markdown files." },
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
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: SyncPayload;

  try {
    payload = (await request.json()) as SyncPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const sourceRepo = payload.sourceRepo?.trim();
  const sourceBranch = payload.sourceBranch?.trim();
  const sourceDirectory = payload.sourceDirectory?.trim() || "_posts";
  const sourcePath = payload.sourcePath?.trim();
  const targetRepo = payload.targetRepo?.trim();
  const targetBranch = payload.targetBranch?.trim();

  if (!sourceRepo || !sourceBranch || !sourcePath) {
    return NextResponse.json(
      { error: "Fields sourceRepo, sourceBranch, and sourcePath are required." },
      { status: 400 },
    );
  }

  if (!targetRepo || !targetBranch) {
    return NextResponse.json(
      { error: "Fields targetRepo and targetBranch are required." },
      { status: 400 },
    );
  }

  if (!sourcePath.endsWith(".md") || !sourcePath.startsWith(`${sourceDirectory}/`)) {
    return NextResponse.json(
      { error: "sourcePath must be a markdown file inside the source directory." },
      { status: 400 },
    );
  }

  const parsedSource = parseRepo(sourceRepo);
  const parsedTarget = parseRepo(targetRepo);

  if (!parsedSource || !parsedTarget) {
    return NextResponse.json(
      { error: "Repository fields must be in owner/name format." },
      { status: 400 },
    );
  }

  const encodedSourcePath = encodeContentPath(sourcePath);
  const sourceFileResponse = await fetch(
    `https://api.github.com/repos/${parsedSource.owner}/${parsedSource.name}/contents/${encodedSourcePath}?ref=${encodeURIComponent(sourceBranch)}`,
    {
      headers: getGithubHeaders(token),
      cache: "no-store",
    },
  );

  if (!sourceFileResponse.ok) {
    const errorData = (await sourceFileResponse.json()) as GithubApiError;
    const response = NextResponse.json(
      { error: errorData.message ?? "Failed to fetch source markdown content." },
      { status: sourceFileResponse.status },
    );
    if (sourceFileResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const sourceFile = (await sourceFileResponse.json()) as GithubContentItem;
  if (sourceFile.type !== "file" || sourceFile.encoding !== "base64" || !sourceFile.content) {
    return NextResponse.json(
      { error: "Unsupported source markdown format." },
      { status: 500 },
    );
  }

  const markdown = Buffer.from(sourceFile.content.replace(/\n/g, ""), "base64").toString(
    "utf8",
  );
  const sourceFileName = sourcePath.split("/").pop();
  if (!sourceFileName) {
    return NextResponse.json({ error: "Invalid source file path." }, { status: 400 });
  }

  const targetPath = `_posts/${sourceFileName}`;
  const encodedTargetPath = encodeContentPath(targetPath);

  const existingTargetResponse = await fetch(
    `https://api.github.com/repos/${parsedTarget.owner}/${parsedTarget.name}/contents/${encodedTargetPath}?ref=${encodeURIComponent(targetBranch)}`,
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
      { error: errorData.message ?? "Failed to check target file." },
      { status: existingTargetResponse.status },
    );
    if (existingTargetResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const putResponse = await fetch(
    `https://api.github.com/repos/${parsedTarget.owner}/${parsedTarget.name}/contents/${encodedTargetPath}`,
    {
      method: "PUT",
      headers: getGithubHeaders(token, true),
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
      { error: putData.message ?? "Failed to sync markdown file." },
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
