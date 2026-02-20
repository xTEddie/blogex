import { GITHUB_API_BASE_URL, getGithubHeaders } from "@/lib/github-api-config";

export type GithubUser = {
  name: string | null;
  login: string;
};

export async function getGithubUser(token: string): Promise<GithubUser | null> {
  const response = await fetch(`${GITHUB_API_BASE_URL}/user`, {
    headers: getGithubHeaders(token),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as GithubUser;
}
