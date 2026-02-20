/**
 * OAuth configuration shared across auth route handlers.
 * Keep these values centralized to make scope/callback updates low-risk.
 */
export const GITHUB_OAUTH_CALLBACK_PATH = "/auth/github/callback";

/**
 * GitHub OAuth scopes requested by blogex.
 * - read:user, user:email: basic identity profile for login
 * - repo: repository read/write operations used by workspace features
 */
export const GITHUB_OAUTH_SCOPE = "read:user user:email repo";
