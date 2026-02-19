import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";

type GithubContentResponse = {
  type?: "file" | "dir";
  path?: string;
  sha?: string;
  encoding?: string;
  content?: string;
  message?: string;
};

type CompareStatus =
  | "same"
  | "different"
  | "missing_target"
  | "missing_source";

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

function decodeBase64Content(content: string) {
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function buildUnifiedDiff(
  sourceText: string,
  targetText: string,
  sourcePath: string,
  targetPath: string,
) {
  const a = sourceText.split("\n");
  const b = targetText.split("\n");
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lines = ["--- " + sourcePath, "+++ " + targetPath, "@@"];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (a[i] === b[j]) {
      lines.push(` ${a[i]}`);
      i += 1;
      j += 1;
      continue;
    }

    if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push(`-${a[i]}`);
      i += 1;
    } else {
      lines.push(`+${b[j]}`);
      j += 1;
    }
  }

  while (i < m) {
    lines.push(`-${a[i]}`);
    i += 1;
  }

  while (j < n) {
    lines.push(`+${b[j]}`);
    j += 1;
  }

  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sourceRepo = request.nextUrl.searchParams.get("sourceRepo")?.trim();
  const sourceBranch = request.nextUrl.searchParams.get("sourceBranch")?.trim();
  const sourcePath = request.nextUrl.searchParams.get("sourcePath")?.trim();
  const targetRepo = request.nextUrl.searchParams.get("targetRepo")?.trim();
  const targetBranch = request.nextUrl.searchParams.get("targetBranch")?.trim();
  const targetDirectory = normalizeDirectory(
    request.nextUrl.searchParams.get("targetDirectory")?.trim() || "_posts",
  );

  if (
    !sourceRepo ||
    !sourceBranch ||
    !sourcePath ||
    !targetRepo ||
    !targetBranch
  ) {
    return NextResponse.json(
      {
        error:
          "Query params sourceRepo, sourceBranch, sourcePath, targetRepo, and targetBranch are required.",
      },
      { status: 400 },
    );
  }

  if (!sourcePath.endsWith(".md")) {
    return NextResponse.json(
      { error: "sourcePath must be a markdown file path." },
      { status: 400 },
    );
  }

  const parsedSource = parseRepo(sourceRepo);
  const parsedTarget = parseRepo(targetRepo);

  if (!parsedSource || !parsedTarget) {
    return NextResponse.json(
      { error: "sourceRepo and targetRepo must be in owner/name format." },
      { status: 400 },
    );
  }

  const sourceFileName = sourcePath.split("/").pop();
  if (!sourceFileName) {
    return NextResponse.json({ error: "Invalid sourcePath." }, { status: 400 });
  }

  const targetPath = `${targetDirectory}/${sourceFileName}`;

  const sourceResponse = await fetch(
    `https://api.github.com/repos/${parsedSource.owner}/${parsedSource.name}/contents/${encodeContentPath(sourcePath)}?ref=${encodeURIComponent(sourceBranch)}`,
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

  if (sourceResponse.status === 404) {
    return NextResponse.json(
      {
        status: "missing_source" as CompareStatus,
        sourcePath,
        targetPath,
        diff: "",
      },
      { status: 200 },
    );
  }

  if (!sourceResponse.ok) {
    const errorData = (await sourceResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? "Failed to load source markdown file." },
      { status: sourceResponse.status },
    );
    if (sourceResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const sourceData = (await sourceResponse.json()) as GithubContentResponse;
  if (
    sourceData.type !== "file" ||
    sourceData.encoding !== "base64" ||
    !sourceData.content
  ) {
    return NextResponse.json(
      { error: "Unsupported source markdown response format." },
      { status: 500 },
    );
  }

  const targetResponse = await fetch(
    `https://api.github.com/repos/${parsedTarget.owner}/${parsedTarget.name}/contents/${encodeContentPath(targetPath)}?ref=${encodeURIComponent(targetBranch)}`,
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

  if (targetResponse.status === 404) {
    return NextResponse.json(
      {
        status: "missing_target" as CompareStatus,
        sourcePath,
        targetPath,
        diff: "",
      },
      { status: 200 },
    );
  }

  if (!targetResponse.ok) {
    const errorData = (await targetResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? "Failed to load target markdown file." },
      { status: targetResponse.status },
    );
    if (targetResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const targetData = (await targetResponse.json()) as GithubContentResponse;
  if (
    targetData.type !== "file" ||
    targetData.encoding !== "base64" ||
    !targetData.content
  ) {
    return NextResponse.json(
      { error: "Unsupported target markdown response format." },
      { status: 500 },
    );
  }

  const sourceText = decodeBase64Content(sourceData.content);
  const targetText = decodeBase64Content(targetData.content);

  if (sourceText === targetText) {
    return NextResponse.json(
      {
        status: "same" as CompareStatus,
        sourcePath,
        targetPath,
        diff: "",
      },
      { status: 200 },
    );
  }

  const diff = buildUnifiedDiff(sourceText, targetText, sourcePath, targetPath);

  return NextResponse.json(
    {
      status: "different" as CompareStatus,
      sourcePath,
      targetPath,
      diff,
    },
    { status: 200 },
  );
}
