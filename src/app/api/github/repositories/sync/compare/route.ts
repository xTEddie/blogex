import { NextRequest, NextResponse } from "next/server";
import { OAUTH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";
import { GITHUB_API_BASE_URL, getGithubHeaders } from "@/lib/github-api-config";

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
  const token = request.cookies.get(OAUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
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
    return jsonError("QUERY_COMPARE_REQUIRED");
  }

  if (!sourcePath.endsWith(".md")) {
    return jsonError("SOURCE_PATH_MARKDOWN_FILE_PATH_REQUIRED");
  }

  const parsedSource = parseRepo(sourceRepo);
  const parsedTarget = parseRepo(targetRepo);

  if (!parsedSource || !parsedTarget) {
    return jsonError("SOURCE_AND_TARGET_REPO_OWNER_NAME_REQUIRED");
  }

  const sourceFileName = sourcePath.split("/").pop();
  if (!sourceFileName) {
    return jsonError("INVALID_SOURCE_PATH");
  }

  const targetPath = `${targetDirectory}/${sourceFileName}`;

  const sourceResponse = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${parsedSource.owner}/${parsedSource.name}/contents/${encodeContentPath(sourcePath)}?ref=${encodeURIComponent(sourceBranch)}`,
    {
      headers: getGithubHeaders(token),
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
      { error: errorData.message ?? API_ERRORS.FAILED_LOAD_SOURCE_MARKDOWN_FILE.message },
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
    return jsonError("UNSUPPORTED_SOURCE_MARKDOWN_RESPONSE_FORMAT");
  }

  const targetResponse = await fetch(
    `${GITHUB_API_BASE_URL}/repos/${parsedTarget.owner}/${parsedTarget.name}/contents/${encodeContentPath(targetPath)}?ref=${encodeURIComponent(targetBranch)}`,
    {
      headers: getGithubHeaders(token),
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
      { error: errorData.message ?? API_ERRORS.FAILED_LOAD_TARGET_MARKDOWN_FILE.message },
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
    return jsonError("UNSUPPORTED_TARGET_MARKDOWN_RESPONSE_FORMAT");
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
