import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth-cookies";

type GithubBranch = {
  name: string;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();

  if (!repo || !repo.includes("/")) {
    return NextResponse.json(
      { error: "Query param `repo` must be in `owner/name` format." },
      { status: 400 },
    );
  }

  const [owner, name] = repo.split("/", 2);

  if (!owner || !name) {
    return NextResponse.json(
      { error: "Invalid repository format." },
      { status: 400 },
    );
  }

  const branches: GithubBranch[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const githubResponse = await fetch(
      `https://api.github.com/repos/${owner}/${name}/branches?per_page=100&page=${page}`,
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
        { error: errorData.message ?? "Failed to fetch branches." },
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
