import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";

type GithubContentItem = {
  type: "file" | "dir";
  name: string;
  path: string;
  size: number;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();
  const branch = request.nextUrl.searchParams.get("branch")?.trim();

  if (!repo || !repo.includes("/")) {
    return jsonError("REPO_QUERY_OWNER_NAME_REQUIRED");
  }

  if (!branch) {
    return jsonError("BRANCH_QUERY_REQUIRED");
  }

  const [owner, name] = repo.split("/", 2);

  if (!owner || !name) {
    return jsonError("INVALID_REPOSITORY_FORMAT");
  }

  const githubResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/contents/_posts?ref=${encodeURIComponent(branch)}`,
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
    return NextResponse.json({ files: [] }, { status: 200 });
  }

  if (!githubResponse.ok) {
    const errorData = (await githubResponse.json()) as { message?: string };
    const response = NextResponse.json(
      { error: errorData.message ?? API_ERRORS.FAILED_FETCH_POSTS_DIRECTORY.message },
      { status: githubResponse.status },
    );
    if (githubResponse.status === 401) {
      return clearAuthCookies(response);
    }
    return response;
  }

  const githubData = (await githubResponse.json()) as GithubContentItem[];

  const files = githubData
    .filter((item) => item.type === "file" && item.name.endsWith(".md"))
    .map((item) => ({
      name: item.name,
      path: item.path,
      size: item.size,
    }));

  return NextResponse.json({ files }, { status: 200 });
}
