/**
 * Shared GitHub REST API request configuration.
 * Centralizing these values keeps behavior consistent across route handlers.
 */
export const GITHUB_API_BASE_URL = "https://api.github.com";
export const GITHUB_API_ACCEPT = "application/vnd.github+json";
export const GITHUB_API_VERSION = "2022-11-28";
export const GITHUB_API_USER_AGENT = "blogex";

export function getGithubHeaders(token: string, options?: { withJson?: boolean }) {
  return {
    Accept: GITHUB_API_ACCEPT,
    Authorization: `Bearer ${token}`,
    ...(options?.withJson ? { "Content-Type": "application/json" } : {}),
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    "User-Agent": GITHUB_API_USER_AGENT,
  };
}
