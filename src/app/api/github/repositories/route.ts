import { NextRequest, NextResponse } from "next/server";

type CreateRepositoryPayload = {
  name?: string;
  private?: boolean;
};

type GithubCreateRepositoryResponse = {
  html_url?: string;
  message?: string;
};

type GithubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const githubResponse = await fetch(
    "https://api.github.com/user/repos?sort=updated&per_page=100",
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
      { error: errorData.message ?? "Failed to fetch repositories." },
      { status: githubResponse.status },
    );
  }

  const githubData = (await githubResponse.json()) as GithubRepository[];

  return NextResponse.json(
    {
      repositories: githubData.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
      })),
    },
    { status: 200 },
  );
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: CreateRepositoryPayload;

  try {
    payload = (await request.json()) as CreateRepositoryPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = payload.name?.trim();
  const isPrivate = Boolean(payload.private);

  if (!name) {
    return NextResponse.json(
      { error: "Repository name is required." },
      { status: 400 },
    );
  }

  const githubResponse = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "blogex",
    },
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
    }),
    cache: "no-store",
  });

  const githubData =
    (await githubResponse.json()) as GithubCreateRepositoryResponse;

  if (!githubResponse.ok) {
    return NextResponse.json(
      { error: githubData.message ?? "Failed to create repository." },
      { status: githubResponse.status },
    );
  }

  return NextResponse.json(
    {
      success: true,
      url: githubData.html_url,
    },
    { status: 201 },
  );
}
