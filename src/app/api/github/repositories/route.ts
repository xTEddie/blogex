import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

type CreateRepositoryPayload = {
  name?: string;
  private?: boolean;
};

type GithubCreateRepositoryResponse = {
  html_url?: string;
  name?: string;
  owner?: {
    login?: string;
  };
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

  let defaultPostContent: string;
  try {
    const templatePath = path.join(
      process.cwd(),
      "src",
      "templates",
      "lorem-ipsum.md",
    );
    defaultPostContent = await readFile(templatePath, "utf8");
  } catch {
    return NextResponse.json(
      { error: "Failed to load default markdown template." },
      { status: 500 },
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

  const owner = githubData.owner?.login;
  const repositoryName = githubData.name;
  let postsInitialized = false;
  let warning: string | undefined;

  if (owner && repositoryName) {
    const createPostsDirectoryResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repositoryName}/contents/_posts/lorem-ipsum.md`,
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
          message: "chore: add default lorem ipsum post",
          content: Buffer.from(defaultPostContent).toString("base64"),
        }),
        cache: "no-store",
      },
    );

    postsInitialized = createPostsDirectoryResponse.ok;

    if (!createPostsDirectoryResponse.ok) {
      const postsError = (await createPostsDirectoryResponse.json()) as {
        message?: string;
      };
      warning =
        postsError.message ?? "Repository was created but _posts initialization failed.";
    }
  } else {
    warning = "Repository was created but _posts initialization metadata was missing.";
  }

  return NextResponse.json(
    {
      success: true,
      url: githubData.html_url,
      postsInitialized,
      warning,
    },
    { status: 201 },
  );
}
