import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";

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
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetRepo = request.nextUrl.searchParams.get("targetRepo")?.trim();
  const targetBranch = request.nextUrl.searchParams.get("targetBranch")?.trim();
  const targetDirectory = normalizeDirectory(
    request.nextUrl.searchParams.get("targetDirectory")?.trim() || "_posts",
  );
  const sourcePath = request.nextUrl.searchParams.get("sourcePath")?.trim();

  if (!targetRepo || !targetBranch || !sourcePath) {
    return NextResponse.json(
      { error: "Query params targetRepo, targetBranch and sourcePath are required." },
      { status: 400 },
    );
  }

  if (!sourcePath.endsWith(".md")) {
    return NextResponse.json(
      { error: "sourcePath must be a markdown file." },
      { status: 400 },
    );
  }

  const parsedTarget = parseRepo(targetRepo);
  if (!parsedTarget) {
    return NextResponse.json(
      { error: "targetRepo must be in owner/name format." },
      { status: 400 },
    );
  }

  const fileName = sourcePath.split("/").pop();
  if (!fileName) {
    return NextResponse.json({ error: "Invalid sourcePath." }, { status: 400 });
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
      { error: errorData.message ?? "Failed to check target markdown file." },
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
