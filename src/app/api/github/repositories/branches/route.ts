import { NextRequest, NextResponse } from "next/server";
import { OAUTH_TOKEN_COOKIE, clearAuthCookies } from "@/lib/auth-cookies";
import { API_ERRORS, jsonError } from "@/lib/api-errors";
import { GITHUB_API_BASE_URL, getGithubHeaders } from "@/lib/github-api-config";

type GithubBranch = {
  name: string;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get(OAUTH_TOKEN_COOKIE)?.value;

  if (!token) {
    return jsonError("UNAUTHORIZED");
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();

  if (!repo || !repo.includes("/")) {
    return jsonError("REPO_QUERY_OWNER_NAME_REQUIRED");
  }

  const [owner, name] = repo.split("/", 2);

  if (!owner || !name) {
    return jsonError("INVALID_REPOSITORY_FORMAT");
  }

  const branches: GithubBranch[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const githubResponse = await fetch(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${name}/branches?per_page=100&page=${page}`,
      {
        headers: getGithubHeaders(token),
        cache: "no-store",
      },
    );

    if (!githubResponse.ok) {
      const errorData = (await githubResponse.json()) as { message?: string };
      const response = NextResponse.json(
        { error: errorData.message ?? API_ERRORS.FAILED_FETCH_BRANCHES.message },
        { status: githubResponse.status },
      );
      if (githubResponse.status === 401) {
        return clearAuthCookies(response);
      }
      return response;
    }

    const pageBranches = (await githubResponse.json()) as GithubBranch[];
    branches.push(...pageBranches);

    const linkHeader = githubResponse.headers.get("link") ?? "";
    hasNext = linkHeader.includes('rel="next"');
    page += 1;
  }

  return NextResponse.json(
    {
      branches: branches.map((branch) => ({ name: branch.name })),
    },
    { status: 200 },
  );
}
