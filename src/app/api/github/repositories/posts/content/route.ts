import { NextRequest, NextResponse } from "next/server";

type GithubFileResponse = {
  type: "file";
  name: string;
  path: string;
  encoding?: string;
  content?: string;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get("gh_oauth_token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = request.nextUrl.searchParams.get("repo")?.trim();
  const branch = request.nextUrl.searchParams.get("branch")?.trim();
  const filePath = request.nextUrl.searchParams.get("path")?.trim();

  if (!repo || !repo.includes("/")) {
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

  if (!filePath || !filePath.startsWith("_posts/") || !filePath.endsWith(".md")) {
    return NextResponse.json(
      { error: "Query param `path` must target a markdown file in _posts." },
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

  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

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
